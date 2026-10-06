import { writeFileSync } from 'node:fs'
import QRCode from 'qrcode'

/** Writes a Y4M video of a QR code, to feed Chromium's fake camera in tests. */
export function writeQrVideo(path: string, text: string, frames = 40): void {
  const W = 640, H = 480
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size, quiet = 4, cell = Math.floor(280 / (size + quiet * 2))
  const total = (size + quiet * 2) * cell
  const x0 = Math.floor((W - total) / 2), y0 = Math.floor((H - total) / 2)
  const Y = Buffer.alloc(W * H, 255)
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!qr.modules.get(r, c)) continue
    for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) Y[(y0 + (r + quiet) * cell + dy) * W + x0 + (c + quiet) * cell + dx] = 0
  }
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128)
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Y, chroma, chroma])
  writeFileSync(path, Buffer.concat([head, ...Array.from({ length: frames }, () => frame)]))
}
