import { blogSitemapNames, type SitemapMeta } from '@sync/shared'
import { apiGet, siteOrigin, xml } from '../utils/site'

/** The sitemap of the blog site is an index: one small file for the fixed pages, then as many article and category/tag files as the blog needs. */
export default defineEventHandler(async event => {
  const o = siteOrigin(event)
  const meta = await apiGet<SitemapMeta & { lastmod: string | null }>(event, '/sitemap-data').catch(() => ({ articles: 0, taxonomy: 0, lastmod: null }))
  const files = blogSitemapNames(meta).map(n => `<sitemap><loc>${xml(`${o}/sitemaps/${n}.xml`)}</loc>${n.startsWith('articles') && meta.lastmod ? `<lastmod>${meta.lastmod}</lastmod>` : ''}</sitemap>`).join('')
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files}</sitemapindex>`
})
