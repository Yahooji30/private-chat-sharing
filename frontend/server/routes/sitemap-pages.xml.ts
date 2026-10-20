import { hiddenPageKeys } from '@sync/shared'
import { sitemapXml } from '../utils/seo'
import { getSeoMap } from '../utils/seomap'

export default defineEventHandler(async event => {
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  // a page the admin switched off is not offered to search engines either
  const off = await $fetch<Record<string, string>>(`${cfg.apiInternal}/api/site`).then(r => hiddenPageKeys(r.hidden_pages), () => [])
  return sitemapXml(getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin, await getSeoMap(String(cfg.apiInternal)), off)
})
