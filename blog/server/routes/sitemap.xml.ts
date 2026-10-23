import { blogSitemapEntries, type SitemapMeta } from '@sync/shared'
import { apiGet, siteOrigin, xml } from '../utils/site'

/** The blog's own sitemap index: one entry per article file and category/tag file, each with when it last changed. */
export default defineEventHandler(async event => {
  const o = siteOrigin(event)
  const meta = await apiGet<SitemapMeta>(event, '/sitemap-data').catch(() => ({ articles: 0, taxonomy: 0 }))
  const files = blogSitemapEntries(meta).map(e => `<sitemap><loc>${xml(`${o}/sitemaps/${e.name}.xml`)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</sitemap>`).join('')
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files}</sitemapindex>`
})
