import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPublic, listCategories, listPublic, rssData, sitemapData, tagArchive } from '../../core/blog'
import { sql } from '../../core/db/client'
import { getSettings } from '../../core/settings'
import { SPACE } from '../plugins/context'

const cache = { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }
const pageQ = z.object({ page: z.coerce.number().int().min(1).max(500).optional(), category: z.string().max(80).optional(), tag: z.string().max(80).optional(), q: z.string().max(100).optional() })

export function blogRoutes(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply) => {
    if (req.method === 'GET' && (req.url.startsWith('/api/blog') || req.url.startsWith('/api/sitemap-data') || req.url === '/api/site')) reply.header('cache-control', 'public, s-maxage=60, stale-while-revalidate=300')
  })
  app.get('/api/blog/articles', cache, async req => listPublic(pageQ.parse(req.query)))
  app.get<{ Params: { slug: string } }>('/api/blog/articles/:slug', cache, async req => getPublic(req.params.slug))
  app.get('/api/blog/categories', cache, () => listCategories())
  app.get<{ Params: { slug: string }; Querystring: { page?: string } }>('/api/blog/tags/:slug', cache, async req => tagArchive(req.params.slug, Number(req.query.page) || 1))
  app.get('/api/blog/rss-data', cache, () => rssData())
  app.get('/api/sitemap-data', cache, () => sitemapData())

  app.get('/api/site', async () => {
    const rows = await sql<{ key: string; value: string }[]>`select key, value from site_settings where key not in ('privacy_md', 'terms_md', 'ads_enabled')`
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  app.get('/api/ads', SPACE, async req => {
    const [flag] = await sql<{ value: string }[]>`select value from site_settings where key = 'ads_enabled'`
    const mine = await getSettings(req.ctx.spaceId)
    if (flag?.value !== 'true' || mine.adsDisabled) return { enabled: false, slots: {} }
    const rows = await sql<{ key: string; html: string }[]>`select key, html from ad_slots where enabled = true and html <> ''`
    return { enabled: true, slots: Object.fromEntries(rows.map(r => [r.key, r.html])) }
  })
}
