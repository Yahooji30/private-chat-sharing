import { mkdtempSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { startNetwork, publicIp, type Network } from './netproxy'
import { writeQrVideo } from './y4m'

const nets: Network[] = []
const ctxs: BrowserContext[] = []
test.afterEach(async () => { await Promise.all(ctxs.splice(0).map(c => c.close())); await Promise.all(nets.splice(0).map(n => n.close())) })

const network = async (): Promise<Network> => { const n = await startNetwork(publicIp()); nets.push(n); return n }
async function deviceOn(browser: Browser, net: Network, path = '/'): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: net.url })
  ctxs.push(ctx)
  await ctx.addInitScript(() => { delete (window as unknown as Record<string, unknown>).showSaveFilePicker })
  const p = await ctx.newPage()
  await p.goto(path)
  await p.waitForSelector('main')
  await p.waitForLoadState('networkidle')
  return p
}
const text = (p: Page) => p.locator('textarea')
const type = async (p: Page, v: string): Promise<void> => { await text(p).fill(v) }
const online = (p: Page) => p.getByRole('button', { name: 'Devices online' })
async function openSettings(p: Page, tab: 'General' | 'Link Device' | 'Linked Devices'): Promise<void> {
  if (!await p.getByRole('dialog', { name: 'Settings' }).isVisible()) await p.getByRole('button', { name: 'Settings' }).click()
  await p.getByRole('tab', { name: tab }).click()
}
async function newCode(p: Page): Promise<string> {
  await openSettings(p, 'Link Device')
  await p.getByRole('tab', { name: 'Share Link' }).click()
  const code = (await p.locator('span.size-9, span.size-10').allTextContents()).join('').replace('-', '')
  expect(code).toMatch(/^[0-9A-Z]{8}$/)
  return code
}
async function redeem(p: Page, code: string): Promise<void> {
  await p.goto('/link')
  await p.getByLabel('Link code').fill(code)
  await p.getByRole('button', { name: 'Link', exact: true }).click()
  await p.waitForURL('**/', { timeout: 15_000 })
  await p.waitForSelector('textarea')
}

test('different networks are isolated; devices on the same network share a space', async ({ browser }) => {
  const [home, away] = [await network(), await network()]
  const laptop = await deviceOn(browser, home), tablet = await deviceOn(browser, home), phone = await deviceOn(browser, away)
  await type(laptop, 'home only')
  await expect(text(tablet)).toHaveValue('home only')
  await expect(text(phone)).toHaveValue('')
  await type(phone, 'phone only')
  await expect(text(laptop)).toHaveValue('home only')
  await expect(online(laptop)).toContainText('2')
  await expect(online(phone)).toContainText('1')
  await openSettings(phone, 'General')
  await expect(phone.getByText(away.ip)).toBeVisible()
})

test('link by code: phone on mobile data joins, both directions sync live, then unlink separates them', async ({ browser }) => {
  const [home, mobile] = [await network(), await network()]
  const laptop = await deviceOn(browser, home), sibling = await deviceOn(browser, home), phone = await deviceOn(browser, mobile, '/link')
  await type(laptop, 'draft from laptop')
  await expect(text(sibling)).toHaveValue('draft from laptop')

  const code = await newCode(laptop)
  await phone.getByLabel('Link code').fill(code)
  await phone.getByRole('button', { name: 'Link', exact: true }).click()
  await phone.waitForURL('**/', { timeout: 15_000 })
  await expect(text(phone)).toHaveValue('draft from laptop')

  await type(phone, 'reply from phone')
  await expect(text(laptop)).toHaveValue('reply from phone')
  await expect(text(sibling)).toHaveValue('reply from phone')
  await type(laptop, 'laptop again')
  await expect(text(phone)).toHaveValue('laptop again')
  for (const p of [laptop, sibling, phone]) await expect(online(p)).toContainText('3')

  await laptop.getByRole('tab', { name: 'Linked Devices' }).click()
  await expect(laptop.getByText(/^Linked (just now|\d+ seconds? ago)/)).toBeVisible()
  await laptop.getByRole('button', { name: 'Close' }).click()

  await openSettings(phone, 'General')
  await phone.getByLabel('Device name').fill('Pocket Phone')
  await phone.getByRole('button', { name: 'Save General Settings' }).click()
  await phone.getByRole('button', { name: 'Close' }).click()
  await online(laptop).click()
  await expect(laptop.getByText('Pocket Phone')).toBeVisible()
  await online(laptop).click()

  await laptop.getByRole('button', { name: 'Settings' }).click()
  await laptop.getByRole('tab', { name: 'General' }).click()
  await laptop.locator('input[type=range]').fill('22')
  await laptop.getByRole('button', { name: 'Save General Settings' }).click()
  await expect.poll(() => text(phone).evaluate(el => getComputedStyle(el).fontSize)).toBe('22px')
  await laptop.getByRole('button', { name: 'Close' }).click()

  await openSettings(laptop, 'Linked Devices')
  laptop.once('dialog', d => void d.accept())
  await laptop.getByRole('button', { name: 'Unlink Pocket Phone' }).click()
  await expect(laptop.getByText('No devices linked by code yet')).toBeVisible()
  await expect(text(phone)).toHaveValue('', { timeout: 15_000 })
  await type(phone, 'alone again')
  await type(laptop, 'laptop only')
  await expect(text(phone)).toHaveValue('alone again')
  await expect(online(laptop)).toContainText('2')
  await expect(online(phone)).toContainText('1')
})

test('a code works once, expires with the link, and wrong codes are rejected in the UI', async ({ browser }) => {
  const [home, a, b] = [await network(), await network(), await network()]
  const laptop = await deviceOn(browser, home), p1 = await deviceOn(browser, a, '/link'), p2 = await deviceOn(browser, b, '/link')
  const code = await newCode(laptop)
  await p2.getByLabel('Link code').fill('ZZZZ-ZZZZ')
  await p2.getByRole('button', { name: 'Link', exact: true }).click()
  await expect(p2.getByText('Code is invalid or expired').first()).toBeVisible()
  await p1.getByLabel('Link code').fill(code)
  await p1.getByRole('button', { name: 'Link', exact: true }).click()
  await p1.waitForURL('**/')
  await p2.getByLabel('Link code').fill(code)
  await p2.getByRole('button', { name: 'Link', exact: true }).click()
  await expect(p2.getByText('Code is invalid or expired').first()).toBeVisible()
})

test('link by IP address: an online device on another network is pulled into the space, then removed again', async ({ browser }) => {
  const [home, away] = [await network(), await network()]
  const laptop = await deviceOn(browser, home), phone = await deviceOn(browser, away)
  await type(laptop, 'shared by ip link')
  await expect(text(phone)).toHaveValue('')

  await openSettings(laptop, 'Link Device')
  await laptop.getByRole('tab', { name: 'IP Address' }).click()
  await laptop.getByLabel('IP address').fill('192.168.1.20')
  await laptop.getByRole('button', { name: 'Link', exact: true }).click()
  await expect(laptop.getByText('Enter a valid public IP address')).toBeVisible()
  await laptop.getByLabel('IP address').fill(away.ip)
  await laptop.getByText('Check if already linked').click()
  await expect(laptop.getByText('Not linked yet.')).toBeVisible()
  await laptop.getByRole('button', { name: 'Link', exact: true }).click()
  await expect(laptop.getByText('Network linked')).toBeVisible()
  await laptop.getByLabel('IP address').fill(away.ip)
  await laptop.getByText('Check if already linked').click()
  await expect(laptop.getByText('Yes, this network is already linked.')).toBeVisible()

  await expect(text(phone)).toHaveValue('shared by ip link', { timeout: 15_000 })
  await type(phone, 'edited on the linked network')
  await expect(text(laptop)).toHaveValue('edited on the linked network')
  await expect(online(laptop)).toContainText('2')

  await laptop.getByRole('tab', { name: 'Linked Devices' }).click()
  await expect(laptop.getByText('Network #1')).toBeVisible()
  laptop.once('dialog', d => void d.accept())
  await laptop.getByRole('button', { name: 'Unlink Network #1' }).click()
  await expect(laptop.getByText('No networks linked by IP address.')).toBeVisible()
  await expect(text(phone)).toHaveValue('', { timeout: 15_000 })
})

test('files travel between linked devices on different networks, and not to unlinked ones', async ({ browser }) => {
  const [home, mobile, stranger] = [await network(), await network(), await network()]
  const laptop = await deviceOn(browser, home), phone = await deviceOn(browser, mobile, '/link'), outsider = await deviceOn(browser, stranger)
  await redeem(phone, await newCode(laptop))
  const data = randomBytes(2 * 1024 * 1024 + 321)
  await laptop.getByTestId('file-input').setInputFiles({ name: 'cross.bin', mimeType: 'application/octet-stream', buffer: data })
  await expect(laptop.getByTestId('file-cross.bin')).toHaveAttribute('data-status', 'complete', { timeout: 20_000 })
  const row = phone.getByTestId('file-cross.bin')
  await expect(row).toHaveAttribute('data-status', 'complete', { timeout: 30_000 })
  const dl = phone.waitForEvent('download')
  await row.getByRole('button', { name: /^Save/ }).click()
  expect(createHash('sha256').update(await readFile((await (await dl).path())!)).digest('hex')).toBe(createHash('sha256').update(data).digest('hex'))
  await expect(outsider.getByTestId('file-cross.bin')).toHaveCount(0)
  await phone.reload()
  await expect(phone.getByTestId('file-cross.bin')).toHaveAttribute('data-status', 'complete')
})

test('secure chat works between devices on different networks', async ({ browser }) => {
  const [n1, n2] = [await network(), await network()]
  const a = await deviceOn(browser, n1, '/chat'), b = await deviceOn(browser, n2)
  await a.getByPlaceholder('At least 8 characters').fill('across the internet')
  await a.getByRole('button', { name: 'Create secure room' }).click()
  await a.waitForURL(/\/c\/[A-Z0-9]+$/)
  const code = a.url().split('/').pop()!
  await expect(a.getByText(`Room ${code}`)).toBeVisible({ timeout: 15_000 })
  await b.goto(`/c/${code}`)
  await b.getByPlaceholder('Room password').fill('across the internet')
  await b.getByRole('button', { name: 'Join chat' }).click()
  await expect(b.getByText('2/4 in room')).toBeVisible({ timeout: 20_000 })
  await a.getByPlaceholder('Write a message').fill('hello from another network')
  await a.getByRole('button', { name: 'Send' }).click()
  await expect(b.getByText('hello from another network')).toBeVisible()
})

test('QR code: the phone scans the laptop QR with a (fake) camera and links', async () => {
  const [home, mobile] = [await network(), await network()]
  const dir = mkdtempSync(join(tmpdir(), 'qr-'))
  const laptopBrowser = await chromium.launch()
  try {
    const laptop = await deviceOn(laptopBrowser, home)
    await type(laptop, 'text reachable after the scan')
    await openSettings(laptop, 'Link Device')
    await expect(laptop.getByText(/Expires in/)).toBeVisible()
    const code = await newCode(laptop)
    await laptop.getByRole('tab', { name: 'QR Code' }).click()
    // the QR encodes the share-link URL of the currently displayed code
    const shown = await laptop.locator('canvas[aria-label="Link QR code"]').evaluate(c => (c as HTMLCanvasElement).width)
    expect(shown).toBeGreaterThan(100)
    writeQrVideo(join(dir, 'qr.y4m'), `${home.url}/link?c=${code}`)
    const phoneBrowser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${join(dir, 'qr.y4m')}`] })
    try {
      const ctx = await phoneBrowser.newContext({ baseURL: mobile.url, permissions: ['camera'] })
      const phone = await ctx.newPage()
      await phone.goto('/link')
      await phone.getByRole('button', { name: 'Scan QR code' }).click()
      await phone.waitForURL('**/', { timeout: 30_000 })
      await expect(text(phone)).toHaveValue('text reachable after the scan', { timeout: 15_000 })
    } finally { await phoneBrowser.close() }
  } finally { await laptopBrowser.close() }
})

test('production build: strict security headers are served and nothing the app does violates them', async ({ browser }) => {
  const net = await network()
  const p = await deviceOn(browser, net)
  const issues: string[] = []
  p.on('console', m => { if (/content security policy|refused to/i.test(m.text())) issues.push(m.text()) })
  p.on('pageerror', e => issues.push(e.message))
  const res = await p.request.get(`${net.url}/chat`)
  const csp = res.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("default-src 'self'"); expect(csp).toContain("object-src 'none'"); expect(csp).toContain("frame-ancestors 'none'")
  expect(res.headers()['x-content-type-options']).toBe('nosniff')
  await type(p, 'see https://example.com')
  await expect(p.getByRole('link', { name: 'https://example.com' })).toBeVisible()
  await openSettings(p, 'Link Device')
  await expect(p.locator('canvas[aria-label="Link QR code"]')).toBeVisible()
  await p.getByRole('tab', { name: 'Share Link' }).click()
  await p.getByRole('tab', { name: 'Linked Devices' }).click()
  await p.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close' }).click()
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await p.getByTestId('file-input').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png })
  const row = p.getByTestId('file-dot.png')
  await expect(row).toHaveAttribute('data-status', 'complete', { timeout: 15_000 })
  await row.getByRole('button', { name: 'Preview' }).click()
  await expect(p.getByRole('dialog').locator('img')).toBeVisible()
  await p.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await p.getByRole('button', { name: 'Toggle theme' }).click()
  for (const path of ['/chat', '/public', '/public/new', '/link']) { await p.goto(path); await p.waitForLoadState('networkidle') }
  expect(issues).toEqual([])
})

test('blog site is server rendered at its root with canonical links, sitemap and old /blog redirects', async ({ request }) => {
  const blog = process.env.E2E_BLOG_URL ?? 'http://localhost:3001'
  const html = await (await request.get(`${blog}/`)).text()
  expect(html).toContain('<title>')
  expect(html).toMatch(/rel="canonical"/)
  expect(html).toContain('og:title')
  expect(await (await request.get(`${blog}/sitemap.xml`)).text()).toContain('<urlset')
  expect(await (await request.get(`${blog}/privacy`)).text()).toContain('Privacy')
  expect((await request.get(`${blog}/p/does-not-exist-xyz`)).status()).toBe(404)
  expect((await request.get(`${blog}/blog`, { maxRedirects: 0 })).status()).toBe(307)
})

test('connection loss: edits made offline sync after reconnecting, and missed text is delivered', async ({ browser }) => {
  const net = await network()
  const laptop = await deviceOn(browser, net), phone = await deviceOn(browser, net)
  await type(laptop, 'online baseline')
  await expect(text(phone)).toHaveValue('online baseline')
  const phoneCtx = phone.context()
  await phoneCtx.setOffline(true)
  await expect(phone.getByText(/You are offline/)).toBeVisible({ timeout: 15_000 })
  await type(phone, 'typed while offline')
  await expect(phone.getByRole('heading', { name: 'Offline' })).toBeVisible()
  await type(laptop, 'laptop moved on')
  await phoneCtx.setOffline(false)
  // last write wins: both devices must converge on one of the two edits, never lose both or diverge
  await expect.poll(async () => { const [l, p] = [await text(laptop).inputValue(), await text(phone).inputValue()]; return l === p && ['typed while offline', 'laptop moved on'].includes(l) }, { timeout: 30_000 }).toBe(true)
  await expect(phone.getByText(/You are offline/)).toHaveCount(0)
})

test('connection loss in chat: the dropped member resumes the same seat and receives only what it missed', async ({ browser }) => {
  const [n1, n2] = [await network(), await network()]
  const a = await deviceOn(browser, n1, '/chat'), b = await deviceOn(browser, n2)
  await a.getByPlaceholder('At least 8 characters').fill('resume me please')
  await a.getByRole('button', { name: 'Create secure room' }).click()
  await a.waitForURL(/\/c\/[A-Z0-9]+$/)
  const code = a.url().split('/').pop()!
  await b.goto(`/c/${code}`)
  await b.getByPlaceholder('Room password').fill('resume me please')
  await b.getByRole('button', { name: 'Join chat' }).click()
  await expect(b.getByText('2/4 in room')).toBeVisible({ timeout: 20_000 })
  const say = async (p: typeof a, t: string): Promise<void> => { await p.getByPlaceholder('Write a message').fill(t); await p.getByRole('button', { name: 'Send' }).click() }
  await say(a, 'before the drop')
  await expect(b.getByText('before the drop')).toBeVisible()
  await b.context().setOffline(true)
  await expect(b.getByText(/reconnecting/)).toBeVisible({ timeout: 15_000 })
  await say(a, 'sent while b was away')
  await b.context().setOffline(false)
  await expect(b.getByText('sent while b was away')).toBeVisible({ timeout: 30_000 })
  await expect(b.getByText('before the drop')).toHaveCount(1)
  await expect(b.getByText('2/4 in room')).toBeVisible()
  await say(b, 'back again')
  await expect(a.getByText('back again')).toBeVisible()
  await expect(a.getByText('2/4 in room')).toBeVisible()
})

test('public pages: only the owning network or the secret link can edit', async ({ browser }) => {
  const [home, away] = [await network(), await network()]
  const owner = await deviceOn(browser, home, '/public/new')
  const slug = `own-${Date.now()}`
  await owner.getByPlaceholder('My page').fill('Owned page')
  await owner.getByPlaceholder(/Hello/).fill('content')
  await owner.getByPlaceholder('my-page').fill(slug)
  await owner.getByRole('button', { name: 'Publish' }).click()
  await expect(owner.getByText('Your page is live')).toBeVisible()
  await owner.getByText('Edit link for other networks').click()
  const editUrl = new URL((await owner.locator('details code').innerText()).trim())

  const stranger = await deviceOn(browser, away, `/public/${slug}/edit`)
  await expect(stranger.getByText('Not allowed')).toBeVisible()
  expect((await stranger.request.put(`${away.url}/api/public-pages/${slug}`, { data: { title: 'hijack' } })).status()).toBe(403)
  expect((await stranger.request.delete(`${away.url}/api/public-pages/${slug}`)).status()).toBe(403)
  const keyed = await deviceOn(browser, away, editUrl.pathname + editUrl.search)
  await expect(keyed.getByPlaceholder('My page')).toHaveValue('Owned page')
  await keyed.getByPlaceholder('My page').fill('Edited from afar')
  await keyed.getByRole('button', { name: 'Save changes' }).click()
  await expect(keyed.getByRole('heading', { name: 'Edited from afar' })).toBeVisible()
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto(`${process.env.E2E_BLOG_URL ?? 'http://localhost:3001'}/p/${slug}`)
  await expect(viewer.getByRole('heading', { name: 'Edited from afar' })).toBeVisible()
  await viewer.context().close()
})
