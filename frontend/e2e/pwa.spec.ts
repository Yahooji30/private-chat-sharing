import { expect, test } from '@playwright/test'

// Needs a production build: pnpm build && pnpm preview, then E2E_BASE_URL=http://localhost:3000 playwright test --project=pwa
test('PWA: manifest and icons are served, and a service worker takes control', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel=manifest]').getAttribute('href')
  expect(href).toBeTruthy()
  const m = await (await request.get(href!)).json()
  expect(m).toMatchObject({ display: 'standalone', start_url: '/' })
  expect(m.icons.length).toBeGreaterThanOrEqual(3)
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true)
})

test('PWA: the app shell keeps working offline', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForSelector('textarea')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('textarea')).toBeVisible()
  await expect(page.getByText('You are offline')).toBeVisible()
})

test('PWA: with the service worker active, client routes still render their own page, offline too', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.goto('/link')
  await expect(page.getByRole('heading', { name: 'Link this device' })).toBeVisible()
  await page.goto('/chat')
  await expect(page.getByRole('heading', { name: /Private chat that/ })).toBeVisible()
  await context.setOffline(true)
  await page.goto('/chat')
  await expect(page.getByRole('heading', { name: /Private chat that/ })).toBeVisible()
  await expect(page.getByText('You are offline')).toBeVisible()
})
