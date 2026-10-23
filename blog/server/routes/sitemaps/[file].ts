import { apiGet, siteOrigin, siteRoot, xml } from '../../utils/site'

const NAME = /^(articles-\d{1,6}|taxonomy-\d{1,6})\.xml$/
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
const wrap = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?><urlset ${NS}>${body}</urlset>`

/** One file of the blog's sitemap: /sitemaps/articles-1.xml, /sitemaps/taxonomy-1.xml, ... Every address comes with when it last changed. */
export default defineEventHandler(async event => {
  const file = String(getRouterParam(event, 'file') ?? '')
  if (!NAME.test(file)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const [kind, num] = file.replace(/\.xml$/, '').split('-')
  const o = siteOrigin(event), root = siteRoot(event)
  const url = (loc: string, lastmod: string, image?: string | null): string =>
    `<url><loc>${xml(o + loc)}</loc><lastmod>${lastmod}</lastmod>${image ? `<image:image><image:loc>${xml(`${root}/media/${image}`)}</image:loc></image:image>` : ''}</url>`
  let body = '', newest = ''
  if (kind === 'articles') {
    const rows = await apiGet<{ slug: string; lastmod: string; image: string | null }[]>(event, `/sitemap-data/articles/${Number(num)}`).catch(() => [])
    body = rows.map(a => url(`/${a.slug}`, a.lastmod, a.image)).join('')
    newest = rows.reduce((m, a) => (a.lastmod > m ? a.lastmod : m), '')
  } else {
    const rows = await apiGet<{ kind: 'category' | 'tag'; slug: string; lastmod: string }[]>(event, `/sitemap-data/taxonomy/${Number(num)}`).catch(() => [])
    body = rows.map(r => url(`/${r.kind === 'category' ? 'category' : 'tag'}/${r.slug}`, r.lastmod)).join('')
    newest = rows.reduce((m, a) => (a.lastmod > m ? a.lastmod : m), '')
  }
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  if (newest) setHeader(event, 'last-modified', new Date(newest).toUTCString())
  return wrap(body)
})
