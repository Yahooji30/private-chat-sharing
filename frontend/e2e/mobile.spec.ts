import { expect, test } from '@playwright/test'

const BLOG = process.env.E2E_BLOG_URL ?? 'http://localhost:3001'
for (const path of ['/', '/chat', '/link', '/features', '/faq', '/privacy', '/terms', `${BLOG}/`, `${BLOG}/features`, `${BLOG}/privacy`]) {
  test(`mobile layout has no horizontal scroll: ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
    expect(sw).toBeLessThanOrEqual(cw)
  })
}

test('mobile: bottom navigation and settings sheet work, tap targets are large enough', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('textarea')
  await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeVisible()
  for (const b of await page.locator('button.btn').all()) {
    const box = await b.boundingBox()
    if (box) expect(box.height).toBeGreaterThanOrEqual(36)
  }
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('button', { name: 'Link' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  const box = await page.getByRole('dialog').boundingBox()
  expect(box!.width).toBeGreaterThan(380)
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('navigation', { name: 'Main' }).last().getByRole('link', { name: 'Chat' }).click()
  await expect(page).toHaveURL(/\/chat$/)
})

test('mobile: found links and files open as pop-up sheets, links are copyable, nothing is hidden behind the tab bar', async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('textarea')
  await page.locator('textarea').fill('docs https://example.com/docs')
  const links = page.getByRole('button', { name: 'Show found links' })
  await expect(links).toBeVisible()
  const bar = await page.getByRole('navigation', { name: 'Main' }).last().boundingBox()
  const box = await links.boundingBox()
  expect(box!.y + box!.height).toBeLessThan(bar!.y) // reachable without scrolling
  await links.click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByRole('link', { name: /example\.com/ })).toBeVisible()
  const copy = dlg.getByRole('button', { name: 'Copy example.com' })
  expect((await copy.boundingBox())!.width).toBeGreaterThanOrEqual(44)
  await dlg.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Show files' }).click()
  await expect(page.getByRole('dialog').getByText(/Drop files here or tap to choose|Add more files/)).toBeVisible()
})

test('mobile: the last button on a page is not hidden behind the tab bar and can be tapped', async ({ page }) => {
  await page.goto('/chat')
  const create = page.getByRole('button', { name: 'Create secure room' })
  await expect(create).toBeVisible()
  // the create-room form comes first
  const joinBox = await page.getByText('Have a room link or code?').boundingBox()
  expect((await create.boundingBox())!.y).toBeLessThan(joinBox!.y)
  await page.getByRole('link', { name: 'FAQ' }).first().scrollIntoViewIfNeeded().catch(() => undefined)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const bar = (await page.getByRole('navigation', { name: 'Main' }).last().boundingBox())!
  const foot = (await page.getByRole('button', { name: 'Feedback' }).boundingBox())!
  expect(foot.y + foot.height).toBeLessThanOrEqual(bar.y + 1) // the footer's feedback link stays above the bar
  await page.getByRole('button', { name: 'Feedback' }).click()
  await expect(page.getByRole('dialog').getByText('Your rating')).toBeVisible()
})
