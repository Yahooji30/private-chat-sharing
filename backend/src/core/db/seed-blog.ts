import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { saveArticle } from '../blog'
import { env } from '../config/env'
import { base32 } from '../lib/crypto'
import { processImage } from '../../api/modules/admin/media'
import { sql } from './client'
import { migrate } from './migrate'
import { SEED_ARTICLES, SEED_CATEGORIES } from './blog-data'

const PALETTE = [['#0058F0', '#FFFFFF', '#F02878'], ['#0B1437', '#0058F0', '#F02878'], ['#F02878', '#FFFFFF', '#0B1437'], ['#0E9F8E', '#FFFFFF', '#0B1437']] as const

/** A flat branded cover (no text, so it never depends on fonts): two device shapes and an accent dot. */
async function makeCover(n: number): Promise<{ id: string; w: number; h: number; variants: Awaited<ReturnType<typeof processImage>>['variants'] }> {
  const [bg, fg, accent] = PALETTE[n % PALETTE.length]!
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="840" viewBox="0 0 1600 840"><rect width="1600" height="840" fill="${bg}"/>
    <circle cx="${300 + (n % 4) * 120}" cy="640" r="260" fill="${accent}" fill-opacity=".22"/>
    <rect x="360" y="170" width="380" height="500" rx="56" fill="none" stroke="${fg}" stroke-width="30"/><rect x="520" y="615" width="60" height="16" rx="8" fill="${fg}"/>
    <rect x="860" y="130" width="380" height="500" rx="56" fill="none" stroke="${accent}" stroke-width="30"/><rect x="1020" y="575" width="60" height="16" rx="8" fill="${accent}"/>
    <path d="M770 330h60l-26-26m26 26-26 26" stroke="${fg}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M830 480h-60l26-26m-26 26 26 26" stroke="${accent}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  const id = base32(14)
  const r = await processImage(await sharp(Buffer.from(svg)).png().toBuffer(), id)
  for (const f of r.files) { const p = join(env.MEDIA_DIR, f.path); await mkdir(dirname(p), { recursive: true }); await writeFile(p, f.data) }
  await sql`insert into media (id, filename, mime, width, height, bytes, variants_json, alt) values (${id}, ${`cover-${n + 1}.webp`}, 'image/webp', ${r.width}, ${r.height}, ${r.variants.at(-1)?.bytes ?? 0}, ${sql.json(r.variants as never)}, 'Two devices exchanging data')`
  return { id, w: r.width, h: r.height, variants: r.variants }
}

/**
 * Loads the starter articles, but only when the blog has no articles at all, so it never overwrites or re-adds anything the
 * admin wrote, edited or deleted. Returns how many were added.
 */
export async function seedBlog(): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from articles`
  if (r?.n) return 0
  const [admin] = await sql<{ id: string }[]>`select id from admins order by created_at limit 1`
  for (const c of SEED_CATEGORIES) await sql`insert into categories (id, slug, name, description) values (${base32(12)}, ${c.slug}, ${c.name}, ${c.description}) on conflict (slug) do nothing`
  const cats = new Map((await sql<{ id: string; slug: string }[]>`select id, slug from categories`).map(c => [c.slug, c.id]))
  let added = 0
  for (const [i, a] of SEED_ARTICLES.entries()) {
    const cover = await makeCover(i)
    const id = await saveArticle(null, {
      title: a.title, slug: a.slug, excerpt: a.excerpt, body: a.body, categoryId: cats.get(a.category) ?? null, tags: a.tags, coverMediaId: cover.id,
      seoTitle: a.seoTitle, seoDescription: a.seoDescription, status: 'published',
    }, admin?.id ?? null)
    // spread the publish dates so the blog reads like it has been going for a while, newest first
    await sql`update articles set published_at = now() - ${i * 6} * interval '1 day' - interval '2 hours', updated_at = now() where id = ${id}`
    added++
  }
  return added
}

if (process.argv[1]?.endsWith('seed-blog.ts')) {
  await migrate()
  const n = await seedBlog()
  await sql.end()
  console.log(n ? `Added ${n} blog articles. Edit them in Admin > Articles.` : 'The blog already has articles, so nothing was added.')
}
