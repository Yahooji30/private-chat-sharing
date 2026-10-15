import { sitemapIndexXml } from '../utils/seo'

export default defineEventHandler(event => {
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return sitemapIndexXml(getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin, String(cfg.public.blogUrl ?? '').replace(/\/$/, ''))
})
