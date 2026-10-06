import { apiGet, siteOrigin, xml, type RssItem } from '../utils/site'

export default defineEventHandler(async event => {
  const o = siteOrigin(event)
  const name = String(useRuntimeConfig(event).public.appName)
  const items = await apiGet<RssItem[]>(event, '/blog/rss-data').catch(() => [] as RssItem[])
  const body = items.map(i => `<item><title>${xml(i.title)}</title><link>${xml(`${o}/${i.slug}`)}</link><guid>${xml(`${o}/${i.slug}`)}</guid>${i.publishedAt ? `<pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>` : ''}${i.category ? `<category>${xml(i.category.name)}</category>` : ''}<description>${xml(i.excerpt)}</description></item>`).join('')
  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(name)} Blog</title><link>${xml(o)}/</link><description>${xml(name)} articles</description>${body}</channel></rss>`
})
