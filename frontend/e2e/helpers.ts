import { expect, test as base, type Browser, type BrowserContext, type Page } from '@playwright/test'

const contexts: BrowserContext[] = []
/** Same as Playwright's test, but every device opened by a test is closed when it ends. */
export const test = base.extend<{ cleanup: void }>({
  cleanup: [async ({}, use) => { await use(); await Promise.all(contexts.splice(0).map(c => c.close())) }, { auto: true }],
})
export { expect }

/** A new device (own cookie). All e2e browsers share 127.0.0.1, so they share one space. */
export async function device(browser: Browser, path = '/'): Promise<Page> {
  const ctx = await browser.newContext()
  contexts.push(ctx)
  await ctx.addInitScript(() => { delete (window as unknown as Record<string, unknown>).showSaveFilePicker })
  const p = await ctx.newPage()
  await p.goto(path)
  return p
}

/** Wipes the shared space and opens two devices on it. */
export async function twoDevices(browser: Browser): Promise<[Page, Page]> {
  const a = await device(browser)
  await a.waitForSelector('textarea')
  await a.evaluate(() => fetch('/api/dev/reset', { method: 'POST' }))
  const b = await device(browser)
  await b.waitForSelector('textarea')
  await expect(a.getByRole('button', { name: 'Devices online' })).toContainText('2', { timeout: 20_000 })
  return [a, b]
}
