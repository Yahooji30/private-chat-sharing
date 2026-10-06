import { expect, test } from '@playwright/test'

const BLOG = process.env.E2E_BLOG_URL ?? 'http://localhost:3001'
for (const path of ['/', '/chat', '/public', '/public/new', '/link', `${BLOG}/`, `${BLOG}/privacy`]) {
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
