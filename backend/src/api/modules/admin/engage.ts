import type { FastifyInstance } from 'fastify'
import { ERR, FEEDBACK_STATUS, SEO_KEYS, SEO_PAGES, faqInputSchema, faqReorderSchema, feedbackUpdateSchema, seoInputSchema, type SeoKey } from '@sync/shared'
import { sql } from '../../../core/db/client'
import { base32 } from '../../../core/lib/crypto'
import { AppError } from '../../../core/lib/errors'
import { renderMarkdown } from '../../../core/lib/markdown'
import { revalidate } from '../../../core/lib/revalidate'
import { audit } from './auth'

interface FaqRow { id: string; question: string; answer_md: string; category: string; position: number; published: boolean; updated_at: Date }
interface FeedbackRow { id: string; name: string; email: string; rating: number; message: string; status: string; public: boolean; created_at: Date }
interface SeoRow { key: string; title: string; description: string; keywords: string; og_title: string; og_description: string; og_media_id: string | null; canonical: string; noindex: boolean; updated_at: Date }

const FEEDBACK_PAGE = 25
const feedbackId = (raw: string): number => {
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n < 1) throw new AppError(ERR.NOT_FOUND, 'Feedback not found', 404)
  return n
}

export function adminEngageRoutes(app: FastifyInstance): void {
  // ---- FAQ ----
  app.get('/api/admin/faqs', async () => (await sql<FaqRow[]>`select id, question, answer_md, category, position, published, updated_at from faqs order by position, created_at, id`)
    .map(r => ({ id: r.id, question: r.question, answer: r.answer_md, category: r.category, published: r.published, updatedAt: r.updated_at.getTime() })))

  app.post('/api/admin/faqs', async req => {
    const b = faqInputSchema.parse(req.body)
    const id = base32(12)
    await sql`insert into faqs (id, question, answer_md, answer_html, category, published, position)
      values (${id}, ${b.question}, ${b.answer}, ${renderMarkdown(b.answer)}, ${b.category}, ${b.published}, (select coalesce(max(position), 0) + 1 from faqs))`
    await audit(req.admin, 'faq.create', id)
    await revalidate()
    return { id }
  })

  app.post('/api/admin/faqs/reorder', async req => {
    const { ids } = faqReorderSchema.parse(req.body)
    await sql.begin(async tx => { for (const [i, id] of ids.entries()) await tx`update faqs set position = ${i + 1} where id = ${id}` })
    await audit(req.admin, 'faq.reorder', String(ids.length))
    await revalidate()
    return { ok: true }
  })

  app.put<{ Params: { id: string } }>('/api/admin/faqs/:id', async req => {
    const b = faqInputSchema.parse(req.body)
    const r = await sql`update faqs set question = ${b.question}, answer_md = ${b.answer}, answer_html = ${renderMarkdown(b.answer)}, category = ${b.category},
      published = ${b.published}, updated_at = now() where id = ${req.params.id} returning id`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Question not found', 404)
    await audit(req.admin, 'faq.update', req.params.id)
    await revalidate()
    return { ok: true }
  })

  app.delete<{ Params: { id: string } }>('/api/admin/faqs/:id', async req => {
    const r = await sql`delete from faqs where id = ${req.params.id} returning id`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Question not found', 404)
    await audit(req.admin, 'faq.delete', req.params.id)
    await revalidate()
    return { ok: true }
  })

  // ---- feedback inbox ----
  app.get<{ Querystring: { status?: string; page?: string } }>('/api/admin/feedback', async req => {
    const status = (FEEDBACK_STATUS as readonly string[]).includes(req.query.status ?? '') ? req.query.status : undefined
    const page = Math.max(1, Number(req.query.page) || 1)
    const where = status ? sql`status = ${status}` : sql`true`
    const rows = await sql<FeedbackRow[]>`select id, name, email, rating, message, status, public, created_at from feedback where ${where} order by created_at desc, id desc limit ${FEEDBACK_PAGE} offset ${(page - 1) * FEEDBACK_PAGE}`
    const [n] = await sql<{ n: number; fresh: number; avg: number | null }[]>`select count(*)::int as n, count(*) filter (where status = 'new')::int as fresh, avg(rating)::float as avg from feedback where ${where}`
    const [all] = await sql<{ fresh: number }[]>`select count(*) filter (where status = 'new')::int as fresh from feedback`
    return {
      items: rows.map(r => ({ id: Number(r.id), name: r.name, email: r.email, rating: r.rating, message: r.message, status: r.status, public: r.public, at: r.created_at.getTime() })),
      total: n?.n ?? 0, page, pageSize: FEEDBACK_PAGE, average: n?.avg ?? null, unread: all?.fresh ?? 0,
    }
  })

  app.patch<{ Params: { id: string } }>('/api/admin/feedback/:id', async req => {
    const b = feedbackUpdateSchema.parse(req.body)
    const [cur] = await sql<{ status: string; public: boolean }[]>`select status, public from feedback where id = ${feedbackId(req.params.id)}`
    if (!cur) throw new AppError(ERR.NOT_FOUND, 'Feedback not found', 404)
    await sql`update feedback set status = ${b.status ?? cur.status}, public = ${b.public ?? cur.public} where id = ${feedbackId(req.params.id)}`
    await audit(req.admin, 'feedback.update', req.params.id)
    if (b.public !== undefined && b.public !== cur.public) await revalidate()
    return { ok: true }
  })

  app.delete<{ Params: { id: string } }>('/api/admin/feedback/:id', async req => {
    const r = await sql<{ public: boolean }[]>`delete from feedback where id = ${feedbackId(req.params.id)} returning public`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Feedback not found', 404)
    await audit(req.admin, 'feedback.delete', req.params.id)
    if (r[0]?.public) await revalidate()
    return { ok: true }
  })

  // ---- per-page SEO ----
  app.get('/api/admin/seo', async () => {
    const rows = await sql<SeoRow[]>`select * from seo_pages`
    const byKey = new Map(rows.map(r => [r.key, r]))
    return SEO_PAGES.map(p => {
      const r = byKey.get(p.key)
      return {
        key: p.key, label: p.label, site: p.site, path: p.path,
        title: r?.title ?? '', description: r?.description ?? '', keywords: r?.keywords ?? '', ogTitle: r?.og_title ?? '', ogDescription: r?.og_description ?? '',
        ogMediaId: r?.og_media_id ?? null, canonical: r?.canonical ?? '', noindex: r?.noindex ?? false, updatedAt: r?.updated_at.getTime() ?? null,
      }
    })
  })

  app.put<{ Params: { key: string } }>('/api/admin/seo/:key', async req => {
    const key = req.params.key as SeoKey
    if (!SEO_KEYS.includes(key)) throw new AppError(ERR.NOT_FOUND, 'Unknown page', 404)
    const b = seoInputSchema.parse(req.body)
    if (b.ogMediaId) {
      const [m] = await sql`select 1 from media where id = ${b.ogMediaId}`
      if (!m) throw new AppError(ERR.BAD_REQUEST, 'Unknown image', 400)
    }
    const empty = !b.title && !b.description && !b.keywords && !b.ogTitle && !b.ogDescription && !b.ogMediaId && !b.canonical && !b.noindex
    if (empty) await sql`delete from seo_pages where key = ${key}`
    else await sql`insert into seo_pages (key, title, description, keywords, og_title, og_description, og_media_id, canonical, noindex)
      values (${key}, ${b.title}, ${b.description}, ${b.keywords}, ${b.ogTitle}, ${b.ogDescription}, ${b.ogMediaId ?? null}, ${b.canonical}, ${b.noindex})
      on conflict (key) do update set title = excluded.title, description = excluded.description, keywords = excluded.keywords, og_title = excluded.og_title,
        og_description = excluded.og_description, og_media_id = excluded.og_media_id, canonical = excluded.canonical, noindex = excluded.noindex, updated_at = now()`
    await audit(req.admin, 'seo.update', key)
    await revalidate()
    return { ok: true }
  })
}
