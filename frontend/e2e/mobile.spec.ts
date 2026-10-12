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
