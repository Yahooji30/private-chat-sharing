import { generateSync } from 'otplib'
import sharp from 'sharp'
import { expect, test, type Page } from '@playwright/test'

const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:5173'
const SITE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const BLOG = process.env.E2E_BLOG_URL ?? 'http://localhost:3001'
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe-12345'

test.beforeEach(async ({ request }) => { await request.post(`${SITE}/api/dev/reset-admin-locks`) })

async function signIn(page: Page): Promise<void> {
  await page.goto(`${ADMIN}/login`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

test('login: guarded routes redirect, wrong password fails, sign out works', async ({ page }) => {
  await page.goto(`${ADMIN}/articles`)
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid credentials')
  await signIn(page)
  await expect(page.getByText('Online devices')).toBeVisible()
  await expect(page.getByText('Open reports')).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto(`${ADMIN}/`)
  await expect(page).toHaveURL(/\/login/)
})

test('write an article with an image, publish it, see it on the site within seconds, then archive it', async ({ page, browser }) => {
  const stamp = Date.now()
  const title = `E2E Article ${stamp}`
  await signIn(page)

  await page.goto(`${ADMIN}/categories`)
  await page.getByLabel('New category').fill(`E2E Cat ${stamp}`)
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText(`E2E Cat ${stamp}`).first()).toBeVisible()

  await page.goto(`${ADMIN}/library`)
  const png = await sharp({ create: { width: 1800, height: 900, channels: 3, background: '#e85a5a' } }).png().toBuffer()
  await page.getByTestId('media-input').setInputFiles({ name: `hero-${stamp}.png`, mimeType: 'image/png', buffer: png })
  await expect(page.locator(`[data-media="hero-${stamp}.png"]`)).toBeVisible({ timeout: 15_000 })
  await page.locator(`[data-media="hero-${stamp}.png"]`).getByLabel(/Alt text/).fill('A red banner')
  await page.getByRole('heading', { name: 'Media library' }).click()

  await page.goto(`${ADMIN}/articles/new`)
  await page.getByLabel('Title', { exact: true }).fill(title)
  await expect(page.locator('#slug')).toHaveValue(`e2e-article-${stamp}`)
  await page.getByLabel('Category').selectOption({ label: `E2E Cat ${stamp}` })
  await page.getByLabel('Excerpt').fill('An excerpt for the e2e article.')
  await page.getByLabel('Markdown body').fill('## First heading\n\nSome **bold** text and a [link](https://example.com).\n\n### Sub heading\n\nMore text.')
  await expect(page.getByLabel('Preview', { exact: true })).toContainText('First heading', { timeout: 5000 })
  await page.getByTestId('pick-cover').click()
  await page.getByRole('dialog').getByRole('button', { name: `Select hero-${stamp}.png` }).click()
  await page.getByLabel('Tags').fill('e2e, playwright')
  await page.getByLabel('Tags').press('Enter')
  await page.getByLabel('SEO title').fill('Custom SEO title')
  await page.getByLabel('SEO description').fill('Custom SEO description for search engines.')
  await expect(page.getByLabel('Search result preview')).toContainText('Custom SEO title')
  await page.getByTestId('publish').click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/articles\/[A-Za-z0-9]+$/)

  const visitor = await (await browser.newContext()).newPage()
  const res = await visitor.goto(`${BLOG}/e2e-article-${stamp}`)
  expect(res?.status()).toBe(200)
  const source = await (await visitor.request.get(`${BLOG}/e2e-article-${stamp}`)).text()
  expect(source).toContain('Some <strong>bold</strong> text')
  expect(source).toContain('application/ld+json')
  expect(source).toContain('"@type":"Article"')
  expect(source).toContain('"@type":"BreadcrumbList"')
  expect(source).toContain('rel="canonical"')
  expect(source).toContain('Custom SEO description for search engines.')
  expect(source).toMatch(/srcset="[^"]*480w/)
  await expect(visitor.getByRole('heading', { name: title })).toBeVisible()
  await expect(visitor.locator('article img').first()).toHaveAttribute('width', '1800')
  await expect(visitor.getByRole('navigation', { name: 'Table of contents' })).toBeVisible()

  await visitor.goto(`${BLOG}/`)
  await expect(visitor.getByRole('link', { name: title }).first()).toBeVisible()
  await visitor.goto(`${BLOG}/tag/playwright`)
  await expect(visitor.getByRole('link', { name: title }).first()).toBeVisible()
  expect(await (await visitor.request.get(`${BLOG}/sitemap.xml`)).text()).toContain(`/e2e-article-${stamp}`)
  expect(await (await visitor.request.get(`${BLOG}/rss.xml`)).text()).toContain(title)
  expect(await (await visitor.request.get(`${BLOG}/robots.txt`)).text()).toContain('Sitemap:')

  await page.goto(`${ADMIN}/articles`)
  await page.getByLabel('Search').fill(`${stamp}`)
  await expect(page.locator(`[data-title="${title}"]`)).toBeVisible()
  await page.locator(`[data-title="${title}"] a`).click()
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Archived', { exact: true })).toBeVisible()
  await expect.poll(async () => (await visitor.request.get(`${BLOG}/e2e-article-${stamp}`)).status(), { timeout: 10_000 }).toBe(404)
  await visitor.context().close()
})

test('two-factor authentication: enable from account, sign in with a code, disable', async ({ page }) => {
  await signIn(page)
  await page.goto(`${ADMIN}/account`)
  await page.getByRole('button', { name: 'Set up 2FA' }).click()
  const secret = (await page.locator('p.font-mono').innerText()).trim()
  await page.getByLabel('Code').fill('000000')
  await page.getByRole('button', { name: 'Enable' }).click()
  await expect(page.getByText(/not valid/)).toBeVisible()
  await page.getByLabel('Code').fill(generateSync({ secret }))
  await page.getByRole('button', { name: 'Enable' }).click()
  await expect(page.getByText('Enabled', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()

  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('6-digit code').fill(generateSync({ secret }))
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.goto(`${ADMIN}/account`)
  await page.getByRole('button', { name: 'Turn off' }).click()
  await page.getByTestId('confirm-yes').click()
  await expect(page.getByRole('button', { name: 'Set up 2FA' })).toBeVisible()
})

test('moderation: a reported public page appears in the queue and unpublishing makes it 404', async ({ page, browser }) => {
  const slug = `e2e-report-${Date.now()}`
  const author = await (await browser.newContext()).newPage()
  await author.goto(`${SITE}/public/new`)
  await author.getByPlaceholder('My page').fill('Reportable page')
  await author.getByPlaceholder(/Hello/).fill('some content')
  await author.getByPlaceholder('my-page').fill(slug)
  await author.getByRole('button', { name: 'Publish' }).click()
  await expect(author.getByText('Your page is live')).toBeVisible()
  await author.goto(`${BLOG}/p/${slug}`)
  await author.waitForLoadState('networkidle')
  author.once('dialog', d => void d.accept('spam and abuse'))
  await author.getByRole('button', { name: 'Report' }).click()
  await expect(author.getByText('Thanks, we will review it')).toBeVisible()

  await signIn(page)
  await page.goto(`${ADMIN}/reports`)
  const row = page.locator('tr', { hasText: slug })
  await expect(row).toContainText('spam and abuse')
  await row.getByRole('button', { name: 'Unpublish' }).click()
  await page.getByTestId('confirm-yes').click()
  await expect(row).toContainText('resolved')
  await expect.poll(async () => (await author.request.get(`${SITE}/api/p/${slug}`)).status()).toBe(404)
  await author.context().close()
})

test('site settings: legal text saved in admin renders on the public site', async ({ page, browser }) => {
  await signIn(page)
  await page.goto(`${ADMIN}/settings`)
  await page.getByRole('tab', { name: 'legal' }).click()
  await page.getByLabel('Privacy policy (Markdown)').fill('# Custom privacy\n\nWe keep nothing.')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Settings saved')).toBeVisible()
  const v = await (await browser.newContext()).newPage()
  await expect.poll(async () => (await v.request.get(`${BLOG}/privacy`)).text(), { timeout: 10_000 }).toContain('Custom privacy')
  await v.close()
})
