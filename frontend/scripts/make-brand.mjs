// Builds the transparent logo, mark and app icons from the supplied artwork (brand/jodbox-logo.jpg).
// Run from frontend/: node scripts/make-brand.mjs   (writes into public/; copy logo*.webp, og-image.jpg and the favicon to blog/public)
import sharp from 'sharp'
const SRC = new URL('../brand/jodbox-logo.jpg', import.meta.url).pathname
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const out = Buffer.from(data)
// "white to alpha": soft shadows fade out, the saturated brand colors stay fully opaque
for (let i = 0; i < W * H; i++) {
  const def = Math.max(255 - data[i * 4], 255 - data[i * 4 + 1], 255 - data[i * 4 + 2])
  const a = Math.max(0, Math.min(1, (def - 8) / 70))
  if (a <= 0) { out[i * 4 + 3] = 0; continue }
  if (a < 1) for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.max(0, Math.min(255, Math.round((data[i * 4 + k] - 255 * (1 - a)) / a)))
  out[i * 4 + 3] = Math.round(a * 255)
}
const lock = await sharp(await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
const { data: td, info: ti } = await sharp(lock.data).raw().toBuffer({ resolveWithObject: true })
const colHas = x => { for (let y = 0; y < ti.height; y++) if (td[(y * ti.width + x) * 4 + 3] > 40) return true; return false }
let x = 0
while (!colHas(x)) x++
while (colHas(x)) x++ // end of the two-tablet mark
const markPng = await sharp(lock.data).extract({ left: 0, top: 0, width: x + 2, height: ti.height }).trim({ threshold: 1 }).resize({ height: 320 }).png().toBuffer()
const webp = { quality: 92, alphaQuality: 100 }
await sharp(lock.data).resize({ width: 840 }).webp(webp).toFile('public/logo.webp')
await sharp(markPng).webp(webp).toFile('public/logo-mark.webp')
await sharp(markPng).resize({ width: 48 }).png().toFile('public/icons/favicon-48.png')
const tile = async (size, radius, scale, file) => {
  const base = await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } }).composite([{ input: await sharp(markPng).resize({ width: Math.round(size * scale) }).toBuffer(), gravity: 'center' }]).png().toBuffer()
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`)
  await sharp(radius ? await sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer() : base).png({ compressionLevel: 9 }).toFile(file)
}
await tile(192, 42, 0.64, 'public/icons/icon-192.png'); await tile(512, 112, 0.64, 'public/icons/icon-512.png')
await tile(180, 0, 0.64, 'public/icons/apple-touch-icon.png'); await tile(512, 0, 0.5, 'public/icons/maskable-512.png')
console.log('brand assets written')
