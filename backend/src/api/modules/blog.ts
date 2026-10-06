import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPublic, listCategories, listPublic, rssData, sitemapData, tagArchive } from '../../core/blog'
import { sql } from '../../core/db/client'

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
    const rows = await sql<{ key: string; value: string }[]>`select key, value from site_settings where key not in ('privacy_md', 'terms_md')`
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })
}
