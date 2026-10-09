import type { SeoEntry } from '@sync/shared'
import { apiGet, siteOrigin, xml, type SitemapData } from '../utils/site'

export default defineEventHandler(async event => {
  const o = siteOrigin(event)
  const [d, seo] = await Promise.all([
    apiGet<SitemapData>(event, '/sitemap-data').catch(() => ({ articles: [], categories: [], tags: [], pages: [] }) as SitemapData),
    apiGet<Record<string, SeoEntry>>(event, '/seo').catch(() => ({}) as Record<string, SeoEntry>),
  ])
  const url = (base: string, loc: string, lastmod?: string): string => `<url><loc>${xml(base + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  const app = String(useRuntimeConfig(event).public.appUrl).replace(/\/$/, '')
  // pages the admin hid from search engines (Admin > SEO > noindex) leave the sitemap too
  const listed = (key: string, base: string, loc: string): string[] => (seo[key]?.noindex ? [] : [url(base, loc)])
  const body = [
    ...listed('home', app, '/'), ...listed('chat', app, '/chat'),
    ...listed('blog', o, '/'), ...listed('features', o, '/features'), ...listed('faq', o, '/faq'), ...listed('feedback', o, '/feedback'),
    ...listed('privacy', o, '/privacy'), ...listed('terms', o, '/terms'),
    ...d.articles.map(a => url(o, `/${a.slug}`, a.lastmod)), ...d.categories.map(c => url(o, `/category/${c}`)),
    ...d.tags.map(t => url(o, `/tag/${t}`)), ...d.pages.map(p => url(o, `/p/${p.slug}`, p.lastmod)),
  ].join('')
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
})
