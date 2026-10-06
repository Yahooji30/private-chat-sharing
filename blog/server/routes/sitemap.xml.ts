import { apiGet, siteOrigin, xml, type SitemapData } from '../utils/site'

export default defineEventHandler(async event => {
  const o = siteOrigin(event)
  const d = await apiGet<SitemapData>(event, '/sitemap-data').catch(() => ({ articles: [], categories: [], tags: [], pages: [] }) as SitemapData)
  const url = (loc: string, lastmod?: string): string => `<url><loc>${xml(o + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  const app = String(useRuntimeConfig(event).public.appUrl).replace(/\/$/, '')
  const body = [`<url><loc>${xml(app)}/</loc></url>`, url('/'), url('/privacy'), url('/terms'),
    ...d.articles.map(a => url(`/${a.slug}`, a.lastmod)), ...d.categories.map(c => url(`/category/${c}`)),
    ...d.tags.map(t => url(`/tag/${t}`)), ...d.pages.map(p => url(`/p/${p.slug}`, p.lastmod))].join('')
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
})
