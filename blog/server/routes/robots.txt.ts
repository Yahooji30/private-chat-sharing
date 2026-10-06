import { siteOrigin } from '../utils/site'

export default defineEventHandler(event => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${siteOrigin(event)}/sitemap.xml`, ''].join('\n')
})
