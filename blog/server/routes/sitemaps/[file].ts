import { apiGet, siteOrigin, xml } from '../../utils/site'

const NAME = /^(articles-\d{1,6}|taxonomy-\d{1,6})\.xml$/
const wrap = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`

/** One file of the blog's sitemap: /sitemaps/articles-1.xml, /sitemaps/taxonomy-1.xml, ... */
export default defineEventHandler(async event => {
  const file = String(getRouterParam(event, 'file') ?? '')
  if (!NAME.test(file)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const [kind, num] = file.replace(/\.xml$/, '').split('-')
  const o = siteOrigin(event)
  const url = (loc: string, lastmod?: string): string => `<url><loc>${xml(o + loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  let body = ''
  if (kind === 'articles') {
    const rows = await apiGet<{ slug: string; lastmod: string }[]>(event, `/sitemap-data/articles/${Number(num)}`).catch(() => [])
    body = rows.map(a => url(`/${a.slug}`, a.lastmod)).join('')
  } else {
    const rows = await apiGet<{ kind: 'category' | 'tag'; slug: string }[]>(event, `/sitemap-data/taxonomy/${Number(num)}`).catch(() => [])
    body = rows.map(r => url(`/${r.kind === 'category' ? 'category' : 'tag'}/${r.slug}`)).join('')
  }
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return wrap(body)
})
