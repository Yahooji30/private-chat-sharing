import type { FastifyInstance } from 'fastify'
import { ERR, pageCreateSchema, pageUpdateSchema, reportSchema } from '@sync/shared'
import { sql } from '../../core/db/client'
import { AppError } from '../../core/lib/errors'
import { base32, hashIp, randomToken, safeEqualHex, sha256 } from '../../core/lib/crypto'
import { renderMarkdown } from '../../core/lib/markdown'
import { K } from '../../core/redis/keys'
import { SPACE } from '../plugins/context'

interface Page { id: string; slug: string; owner_space_id: string | null; edit_token_hash: string; title: string; body_md: string; body_html: string; indexable: boolean; status: string; views: number; created_at: Date; updated_at: Date }

const pub = (p: Page) => ({ slug: p.slug, title: p.title, html: p.body_html, indexable: p.indexable, views: p.views, updatedAt: p.updated_at.getTime() })

export function pageRoutes(app: FastifyInstance): void {
  const find = async (slug: string): Promise<Page> => {
    const [p] = await sql<Page[]>`select * from public_pages where slug = ${slug}`
    if (!p) throw new AppError(ERR.NOT_FOUND, 'Page not found', 404)
    return p
  }
  const owned = async (slug: string, spaceId: string, token: unknown): Promise<Page> => {
    const p = await find(slug)
    const byToken = typeof token === 'string' && token.length > 8 && safeEqualHex(sha256(token), p.edit_token_hash)
    if (p.owner_space_id !== spaceId && !byToken) throw new AppError(ERR.FORBIDDEN, 'Not allowed', 403)
    return p
  }

  app.get('/api/public-pages', SPACE, async req => {
    const rows = await sql<Page[]>`select * from public_pages where owner_space_id = ${req.ctx.spaceId} order by updated_at desc`
    return rows.map(p => ({ ...pub(p), title: p.title, status: p.status, createdAt: p.created_at.getTime() }))
  })

  app.post('/api/public-pages', SPACE, async req => {
    const key = `rl:pagecreate:${req.ctx.spaceId}`
    const n = await app.redis.incr(key)
    if (n === 1) await app.redis.expire(key, 3600)
    if (n > 10) throw new AppError(ERR.RATE_LIMITED, 'Too many pages created, try later', 429)
    const b = pageCreateSchema.parse(req.body)
    const slug = b.slug ?? base32(8).toLowerCase()
    const token = randomToken()
    try {
      await sql`insert into public_pages (id, slug, owner_space_id, edit_token_hash, title, body_md, body_html, indexable)
        values (${base32(12)}, ${slug}, ${req.ctx.spaceId}, ${sha256(token)}, ${b.title}, ${b.body}, ${renderMarkdown(b.body)}, ${b.indexable})`
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new AppError(ERR.SLUG_TAKEN, 'That link name is taken', 409)
      throw e
    }
    return { slug, editToken: token }
  })

  app.get<{ Params: { slug: string } }>('/api/public-pages/:slug', SPACE, async req => {
    const p = await owned(req.params.slug, req.ctx.spaceId, req.headers['x-edit-token'])
    return { ...pub(p), body: p.body_md, status: p.status }
  })

  app.put<{ Params: { slug: string } }>('/api/public-pages/:slug', SPACE, async req => {
    const p = await owned(req.params.slug, req.ctx.spaceId, req.headers['x-edit-token'])
    const b = pageUpdateSchema.parse(req.body)
    const body = b.body ?? p.body_md
    await sql`update public_pages set title = ${b.title ?? p.title}, body_md = ${body}, body_html = ${renderMarkdown(body)},
      indexable = ${b.indexable ?? p.indexable}, updated_at = now() where id = ${p.id}`
    return { ok: true }
  })

  app.delete<{ Params: { slug: string } }>('/api/public-pages/:slug', SPACE, async req => {
    const p = await owned(req.params.slug, req.ctx.spaceId, req.headers['x-edit-token'])
    await sql`delete from public_pages where id = ${p.id}`
    return { ok: true }
  })

  app.get<{ Params: { slug: string } }>('/api/p/:slug', async req => {
    const p = await find(req.params.slug)
    if (p.status !== 'published') throw new AppError(ERR.NOT_FOUND, 'Page not found', 404)
    const h = hashIp(req.ip)
    if (h && await app.redis.set(K.pageView(p.slug, h), '1', 'EX', 86400, 'NX')) {
      await sql`update public_pages set views = views + 1 where id = ${p.id}`
      p.views += 1
    }
    return pub(p)
  })

  app.post<{ Params: { slug: string } }>('/api/p/:slug/report', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async req => {
    const p = await find(req.params.slug)
    const { reason } = reportSchema.parse(req.body)
    await sql`insert into page_reports (page_id, reason, ip_hash) values (${p.id}, ${reason}, ${hashIp(req.ip) ?? 'unknown'})`
    return { ok: true }
  })
}
