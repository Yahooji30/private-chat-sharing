import { articleInputSchema, type ArticleInput } from '@sync/shared'
import { sql } from './db/client'
import { AppError } from './lib/errors'
import { base32 } from './lib/crypto'
import { renderArticle } from './lib/markdown'
import { slugify, uniqueSlug } from './lib/slug'
import { revalidate } from './lib/revalidate'

export const PAGE_SIZE = 12
export type Variant = { w: number; h: number; path: string; bytes: number }
export interface MediaRef { id: string; alt: string; width: number; height: number; variants: Variant[] }

interface ListRow {
  id: string; slug: string; title: string; excerpt: string; published_at: Date | null; reading_min: number
  cat_slug: string | null; cat_name: string | null
  m_id: string | null; m_alt: string | null; m_w: number | null; m_h: number | null; m_variants: Variant[] | null
}

const media = (r: { m_id: string | null; m_alt: string | null; m_w: number | null; m_h: number | null; m_variants: Variant[] | null }): MediaRef | null =>
  r.m_id ? { id: r.m_id, alt: r.m_alt ?? '', width: r.m_w ?? 0, height: r.m_h ?? 0, variants: r.m_variants ?? [] } : null

const card = (r: ListRow) => ({
  slug: r.slug, title: r.title, excerpt: r.excerpt, publishedAt: r.published_at?.toISOString() ?? null, readingMin: r.reading_min,
  category: r.cat_slug ? { slug: r.cat_slug, name: r.cat_name } : null, cover: media(r),
})

const COLS = sql`a.id, a.slug, a.title, a.excerpt, a.published_at, a.reading_min, c.slug as cat_slug, c.name as cat_name,
  m.id as m_id, m.alt as m_alt, m.width as m_w, m.height as m_h, m.variants_json as m_variants`
const JOINS = sql`from articles a left join categories c on c.id = a.category_id left join media m on m.id = a.cover_media_id`
const LIVE = sql`a.status = 'published' and a.published_at <= now()`

export async function listPublic(q: { page?: number; category?: string; tag?: string; q?: string }) {
  const page = Math.max(1, q.page ?? 1)
  const where = sql`${LIVE}
    ${q.category ? sql`and c.slug = ${q.category}` : sql``}
    ${q.tag ? sql`and exists (select 1 from article_tags at join tags t on t.id = at.tag_id where at.article_id = a.id and t.slug = ${q.tag})` : sql``}
    ${q.q ? sql`and a.search @@ plainto_tsquery('simple', ${q.q})` : sql``}`
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`select count(*)::int as n ${JOINS} where ${where}`
  const rows = await sql<ListRow[]>`select ${COLS} ${JOINS} where ${where} order by a.published_at desc, a.id limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`
  return { items: rows.map(card), total: n, page, pages: Math.max(1, Math.ceil(n / PAGE_SIZE)) }
}

export async function getPublic(slug: string) {
  const [a] = await sql<(ListRow & { body_html: string; toc_json: unknown; seo_title: string; seo_description: string; updated_at: Date; author: string | null; category_id: string | null; og_id: string | null }) []>`
    select ${COLS}, a.body_html, a.toc_json, a.seo_title, a.seo_description, a.updated_at, a.category_id, a.og_media_id as og_id,
      (select name from admins where id = a.author_admin_id) as author
    ${JOINS} where a.slug = ${slug} and ${LIVE}`
  if (!a) throw new AppError('NOT_FOUND', 'Article not found', 404)
  const tags = await sql<{ slug: string; name: string }[]>`select t.slug, t.name from article_tags at join tags t on t.id = at.tag_id where at.article_id = ${a.id} order by t.name`
  const related = a.category_id
    ? await sql<ListRow[]>`select ${COLS} ${JOINS} where ${LIVE} and a.category_id = ${a.category_id} and a.id <> ${a.id} order by a.published_at desc limit 3`
    : []
  const [og] = a.og_id ? await sql<{ id: string; alt: string; width: number; height: number; variants_json: Variant[] }[]>`select id, alt, width, height, variants_json from media where id = ${a.og_id}` : []
  return {
    ...card(a), html: a.body_html, toc: a.toc_json, seoTitle: a.seo_title, seoDescription: a.seo_description, updatedAt: a.updated_at.toISOString(),
    author: a.author, tags, related: related.map(card),
    og: og ? { id: og.id, alt: og.alt, width: og.width, height: og.height, variants: og.variants_json } : null,
  }
}

export const listCategories = () => sql<{ slug: string; name: string; description: string; count: number }[]>`
  select c.slug, c.name, c.description, (select count(*)::int from articles a where a.category_id = c.id and a.status = 'published' and a.published_at <= now()) as count
  from categories c order by c.name`

export async function tagArchive(slug: string, page: number) {
  const [t] = await sql<{ slug: string; name: string }[]>`select slug, name from tags where slug = ${slug}`
  if (!t) throw new AppError('NOT_FOUND', 'Tag not found', 404)
  return { tag: t, ...(await listPublic({ tag: slug, page })) }
}

export async function sitemapData() {
  const articles = await sql<{ slug: string; updated_at: Date }[]>`select slug, updated_at from articles a where ${LIVE} order by published_at desc`
  const categories = await sql<{ slug: string }[]>`select slug from categories c where exists (select 1 from articles a where a.category_id = c.id and ${LIVE})`
  const tags = await sql<{ slug: string }[]>`select t.slug from tags t where exists (select 1 from article_tags at join articles a on a.id = at.article_id where at.tag_id = t.id and ${LIVE})`
  const pages = await sql<{ slug: string; updated_at: Date }[]>`select slug, updated_at from public_pages where status = 'published' and indexable = true`
  return {
    articles: articles.map(a => ({ slug: a.slug, lastmod: a.updated_at.toISOString() })),
    categories: categories.map(c => c.slug), tags: tags.map(t => t.slug),
    pages: pages.map(p => ({ slug: p.slug, lastmod: p.updated_at.toISOString() })),
  }
}

export async function rssData() {
  const rows = await sql<(ListRow & { updated_at: Date })[]>`select ${COLS}, a.updated_at ${JOINS} where ${LIVE} order by a.published_at desc limit 30`
  return rows.map(card)
}

// ---- writes (admin) ----
const nowIso = (): number => Date.now()

async function resolveTags(names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const name of [...new Set(names.map(n => n.trim()).filter(Boolean))]) {
    const slug = slugify(name)
    const [t] = await sql<{ id: string }[]>`insert into tags (id, slug, name) values (${base32(12)}, ${slug}, ${name}) on conflict (slug) do update set slug = excluded.slug returning id`
    if (t) ids.push(t.id)
  }
  return ids
}

function checkStatus(i: ArticleInput): Date | null {
  if (i.status !== 'scheduled') return null
  const at = i.publishAt ? new Date(i.publishAt) : null
  if (!at || at.getTime() <= nowIso()) throw new AppError('BAD_REQUEST', 'Schedule time must be in the future', 400)
  return at
}

async function fkCheck(i: ArticleInput): Promise<void> {
  for (const [table, id] of [['media', i.coverMediaId], ['media', i.ogMediaId], ['categories', i.categoryId]] as const) {
    if (!id) continue
    const [r] = await sql`select 1 from ${sql(table)} where id = ${id}`
    if (!r) throw new AppError('BAD_REQUEST', `Unknown ${table === 'media' ? 'image' : 'category'}`, 400)
  }
}

export async function saveArticle(id: string | null, raw: unknown, adminId: string): Promise<string> {
  const i = articleInputSchema.parse(raw)
  const at = checkStatus(i)
  await fkCheck(i)
  const { html, toc, words } = renderArticle(i.body)
  const reading = Math.max(1, Math.round(words / 200))
  const tagIds = await resolveTags(i.tags)
  const [cur] = id ? await sql<{ slug: string; published_at: Date | null }[]>`select slug, published_at from articles where id = ${id}` : []
  if (id && !cur) throw new AppError('NOT_FOUND', 'Article not found', 404)
  const base = i.slug ?? cur?.slug ?? slugify(i.title)
  const slug = await uniqueSlug(base, async s => !!(await sql`select 1 from articles where slug = ${s} and id is distinct from ${id}`)[0])
  const publishedAt = i.status === 'published' ? (cur?.published_at ?? new Date()) : (cur?.published_at ?? null)
  const cols = {
    slug, title: i.title, excerpt: i.excerpt, body_md: i.body, body_html: html, toc_json: sql.json(toc), cover_media_id: i.coverMediaId ?? null,
    og_media_id: i.ogMediaId ?? null, category_id: i.categoryId ?? null, status: i.status, publish_at: at, published_at: publishedAt,
    seo_title: i.seoTitle, seo_description: i.seoDescription, reading_min: reading,
  }
  const articleId = id ?? base32(14)
  await sql.begin(async tx => {
    if (id) await tx`update articles set ${tx(cols)}, updated_at = now() where id = ${id}`
    else await tx`insert into articles ${tx({ id: articleId, author_admin_id: adminId, ...cols })}`
    await tx`delete from article_tags where article_id = ${articleId}`
    for (const t of tagIds) await tx`insert into article_tags (article_id, tag_id) values (${articleId}, ${t}) on conflict do nothing`
  })
  revalidate()
  return articleId
}

export async function deleteArticle(id: string): Promise<void> {
  const r = await sql`delete from articles where id = ${id} returning id`
  if (!r.length) throw new AppError('NOT_FOUND', 'Article not found', 404)
  revalidate()
}

/** Cron: scheduled articles whose time has come become published. */
export async function publishDue(): Promise<number> {
  const r = await sql`update articles set status = 'published', published_at = coalesce(publish_at, now()), updated_at = now() where status = 'scheduled' and publish_at <= now() returning id`
  if (r.length) revalidate()
  return r.length
}
