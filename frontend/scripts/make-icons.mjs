// Renders public/icon.svg into the PNG icons used by the PWA manifest. Run: node scripts/make-icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
const render = async (size, out, pad = 0) => {
  await page.setViewportSize({ width: size, height: size })
  const inner = size - pad * 2
  await page.setContent(`<body style="margin:0;background:${pad ? '#1b1b1f' : 'transparent'}"><div style="padding:${pad}px"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${inner}" height="${inner}" style="display:block"></div></body>`)
  writeFileSync(new URL(`../public/icons/${out}`, import.meta.url), await page.screenshot({ omitBackground: !pad }))
}
await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'maskable-512.png', 64)
await render(180, 'apple-touch-icon.png', 12)
await browser.close()
