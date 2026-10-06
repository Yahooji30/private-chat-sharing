import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import multipart from '@fastify/multipart'
import { fileTypeFromBuffer } from 'file-type'
import type { FastifyInstance } from 'fastify'
import sharp from 'sharp'
import { z } from 'zod'
import { ERR } from '@sync/shared'
import type { Variant } from '../../../core/blog'
import { env } from '../../../core/config/env'
import { sql } from '../../../core/db/client'
import { AppError } from '../../../core/lib/errors'
import { base32 } from '../../../core/lib/crypto'
import { audit } from './auth'

sharp.concurrency(1)
const WIDTHS = [480, 960, 1600]
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const MAX_BYTES = 10 * 1024 * 1024
const PIXEL_LIMIT = 40_000_000

interface Row { id: string; filename: string; mime: string; width: number; height: number; bytes: number; variants_json: Variant[]; alt: string; created_at: Date }
const out = (r: Row) => ({ id: r.id, filename: r.filename, width: r.width, height: r.height, bytes: r.bytes, alt: r.alt, variants: r.variants_json, createdAt: r.created_at.getTime() })

export async function processImage(buf: Buffer, id: string): Promise<{ width: number; height: number; variants: Variant[]; files: { path: string; data: Buffer }[] }> {
  const base = sharp(buf, { limitInputPixels: PIXEL_LIMIT, animated: false }).rotate()
  const meta = await sharp(await base.clone().toBuffer()).metadata()
  const width = meta.width ?? 0, height = meta.height ?? 0
  if (!width || !height) throw new AppError(ERR.BAD_REQUEST, 'Unreadable image', 400)
  const d = new Date()
  const dir = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const sizes = [...new Set([...WIDTHS.filter(w => w < width), width])].sort((a, b) => a - b)
  const files: { path: string; data: Buffer }[] = []
  const variants: Variant[] = []
  for (const w of sizes) {
    const { data, info } = await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    const path = `${dir}/${id}-${w}.webp`
    files.push({ path, data })
    variants.push({ w: info.width, h: info.height, path, bytes: data.length })
  }
  return { width, height, variants, files }
}

export function mediaRoutes(app: FastifyInstance): void {
  void app.register(multipart, { limits: { fileSize: MAX_BYTES, files: 1, fields: 4 } })

  app.post('/api/admin/media', async req => {
    const part = await req.file()
    if (!part) throw new AppError(ERR.BAD_REQUEST, 'No file', 400)
    let buf: Buffer
    try { buf = await part.toBuffer() } catch { throw new AppError(ERR.BAD_REQUEST, 'File too large (10 MB max)', 413) }
    if (part.file.truncated) throw new AppError(ERR.BAD_REQUEST, 'File too large (10 MB max)', 413)
    const type = await fileTypeFromBuffer(buf)
    if (!type || !ALLOWED.has(type.mime)) throw new AppError(ERR.BAD_REQUEST, 'Only JPG, PNG, WebP and GIF images are allowed', 400)
    const id = base32(14)
    let r: Awaited<ReturnType<typeof processImage>>
    try { r = await processImage(buf, id) } catch (e) { if (e instanceof AppError) throw e; throw new AppError(ERR.BAD_REQUEST, 'Could not process that image', 400) }
    for (const f of r.files) { const p = join(env.MEDIA_DIR, f.path); await mkdir(dirname(p), { recursive: true }); await writeFile(p, f.data) }
    const name = part.filename.replace(/[^\w.\- ]+/g, '').slice(0, 100) || 'image'
    const [row] = await sql<Row[]>`insert into media (id, filename, mime, width, height, bytes, variants_json) values (${id}, ${name}, 'image/webp', ${r.width}, ${r.height}, ${buf.length}, ${sql.json(r.variants)}) returning *`
    await audit(req.admin, 'media.upload', id)
    return out(row as Row)
  })

  app.get<{ Querystring: { page?: string } }>('/api/admin/media', async req => {
    const page = Math.max(1, Number(req.query.page) || 1)
    const rows = await sql<Row[]>`select * from media order by created_at desc limit 40 offset ${(page - 1) * 40}`
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from media`
    return { items: rows.map(out), total: n?.n ?? 0, page }
  })

  app.patch<{ Params: { id: string } }>('/api/admin/media/:id', async req => {
    const { alt } = z.object({ alt: z.string().max(200) }).parse(req.body)
    const r = await sql`update media set alt = ${alt} where id = ${req.params.id} returning id`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Image not found', 404)
    return { ok: true }
  })

  app.delete<{ Params: { id: string } }>('/api/admin/media/:id', async req => {
    const [used] = await sql`select 1 from articles where cover_media_id = ${req.params.id} or og_media_id = ${req.params.id} limit 1`
    const [site] = await sql`select 1 from site_settings where key = 'default_og_media_id' and value = ${req.params.id}`
    if (used || site) throw new AppError(ERR.CONFLICT, 'This image is used by an article or the site settings', 409)
    const [m] = await sql<Row[]>`delete from media where id = ${req.params.id} returning *`
    if (!m) throw new AppError(ERR.NOT_FOUND, 'Image not found', 404)
    for (const v of m.variants_json) await rm(join(env.MEDIA_DIR, v.path), { force: true })
    await audit(req.admin, 'media.delete', req.params.id)
    return { ok: true }
  })
}
