import type { FastifyInstance } from 'fastify'
import { ERR, nameSlugSchema } from '@sync/shared'
import { saveArticle, deleteArticle } from '../../../core/blog'
import { sql } from '../../../core/db/client'
import { AppError } from '../../../core/lib/errors'
import { base32 } from '../../../core/lib/crypto'
import { renderArticle } from '../../../core/lib/markdown'
import { revalidate } from '../../../core/lib/revalidate'
import { slugify } from '../../../core/lib/slug'
import { audit } from './auth'

interface Row { id: string; slug: string; title: string; excerpt: string; status: string; category_id: string | null; cat_name: string | null; publish_at: Date | null; published_at: Date | null; updated_at: Date; author: string | null }

export function contentRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { status?: string; category?: string; q?: string; page?: string } }>('/api/admin/articles', async req => {
    const { status, category, q } = req.query
    const page = Math.max(1, Number(req.query.page) || 1)
    const where = sql`true ${status ? sql`and a.status = ${status}` : sql``} ${category ? sql`and a.category_id = ${category}` : sql``} ${q ? sql`and (a.title ilike ${'%' + q.replace(/[%_]/g, '') + '%'})` : sql``}`
    const rows = await sql<Row[]>`select a.id, a.slug, a.title, a.excerpt, a.status, a.category_id, c.name as cat_name, a.publish_at, a.published_at, a.updated_at,
      (select name from admins where id = a.author_admin_id) as author
      from articles a left join categories c on c.id = a.category_id where ${where} order by a.updated_at desc limit 25 offset ${(page - 1) * 25}`
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from articles a where ${where}`
    return {
      items: rows.map(r => ({ id: r.id, slug: r.slug, title: r.title, status: r.status, category: r.cat_name, author: r.author, publishAt: r.publish_at?.getTime() ?? null, publishedAt: r.published_at?.getTime() ?? null, updatedAt: r.updated_at.getTime() })),
      total: n?.n ?? 0, page,
    }
  })

  app.get<{ Params: { id: string } }>('/api/admin/articles/:id', async req => {
    const [a] = await sql<{ id: string; slug: string; title: string; excerpt: string; body_md: string; cover_media_id: string | null; og_media_id: string | null; category_id: string | null; status: string; publish_at: Date | null; published_at: Date | null; seo_title: string; seo_description: string }[]>`select * from articles where id = ${req.params.id}`
    if (!a) throw new AppError(ERR.NOT_FOUND, 'Article not found', 404)
    const tags = await sql<{ name: string }[]>`select t.name from article_tags at join tags t on t.id = at.tag_id where at.article_id = ${a.id} order by t.name`
    return { id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, body: a.body_md, coverMediaId: a.cover_media_id, ogMediaId: a.og_media_id, categoryId: a.category_id, tags: tags.map(t => t.name),
      status: a.status, publishAt: a.publish_at?.toISOString() ?? null, publishedAt: a.published_at?.toISOString() ?? null, seoTitle: a.seo_title, seoDescription: a.seo_description }
  })

  app.post('/api/admin/articles', async req => {
    const id = await saveArticle(null, req.body, req.admin.id)
    await audit(req.admin, 'article.create', id)
    const [a] = await sql<{ slug: string }[]>`select slug from articles where id = ${id}`
    return { id, slug: a?.slug }
  })
  app.put<{ Params: { id: string } }>('/api/admin/articles/:id', async req => {
    const id = await saveArticle(req.params.id, req.body, req.admin.id)
    await audit(req.admin, 'article.update', id)
    const [a] = await sql<{ slug: string }[]>`select slug from articles where id = ${id}`
    return { id, slug: a?.slug }
  })
  app.delete<{ Params: { id: string } }>('/api/admin/articles/:id', async req => {
    await deleteArticle(req.params.id)
    await audit(req.admin, 'article.delete', req.params.id)
    return { ok: true }
  })
  app.post('/api/admin/articles/preview', async req => {
    const body = (req.body as { body?: unknown })?.body
    if (typeof body !== 'string' || body.length > 200_000) throw new AppError(ERR.BAD_REQUEST, 'Invalid body', 400)
    return { html: renderArticle(body).html }
  })

  for (const [path, table, label] of [['categories', 'categories', 'category'], ['tags', 'tags', 'tag']] as const) {
    const t = sql(table)
    app.get(`/api/admin/${path}`, async () => (await sql<{ id: string; slug: string; name: string; description?: string; count: number }[]>`
      select x.id, x.slug, x.name, ${table === 'categories' ? sql`x.description,` : sql``}
      ${table === 'categories' ? sql`(select count(*)::int from articles where category_id = x.id)` : sql`(select count(*)::int from article_tags where tag_id = x.id)`} as count
      from ${t} x order by x.name`))
    app.post(`/api/admin/${path}`, async req => {
      const b = nameSlugSchema.parse(req.body)
      const id = base32(12), slug = b.slug ?? slugify(b.name)
      const r = table === 'categories'
        ? await sql`insert into categories (id, slug, name, description) values (${id}, ${slug}, ${b.name}, ${b.description ?? ''}) on conflict (slug) do nothing returning id`
        : await sql`insert into tags (id, slug, name) values (${id}, ${slug}, ${b.name}) on conflict (slug) do nothing returning id`
      if (!r.length) throw new AppError(ERR.CONFLICT, `A ${label} with that slug exists`, 409)
      await audit(req.admin, `${label}.create`, slug)
      revalidate()
      return { id, slug }
    })
    app.put<{ Params: { id: string } }>(`/api/admin/${path}/:id`, async req => {
      const b = nameSlugSchema.parse(req.body)
      try {
        const r = table === 'categories'
          ? await sql`update categories set name = ${b.name}, slug = ${b.slug ?? slugify(b.name)}, description = ${b.description ?? ''} where id = ${req.params.id} returning id`
          : await sql`update tags set name = ${b.name}, slug = ${b.slug ?? slugify(b.name)} where id = ${req.params.id} returning id`
        if (!r.length) throw new AppError(ERR.NOT_FOUND, `${label} not found`, 404)
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new AppError(ERR.CONFLICT, `A ${label} with that slug exists`, 409)
        throw e
      }
      await audit(req.admin, `${label}.update`, req.params.id)
      revalidate()
      return { ok: true }
    })
    app.delete<{ Params: { id: string } }>(`/api/admin/${path}/:id`, async req => {
      const r = await sql`delete from ${t} where id = ${req.params.id} returning id`
      if (!r.length) throw new AppError(ERR.NOT_FOUND, `${label} not found`, 404)
      await audit(req.admin, `${label}.delete`, req.params.id)
      revalidate()
      return { ok: true }
    })
  }
}
