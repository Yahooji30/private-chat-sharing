import { blogSitemapNames, type SitemapMeta } from '@sync/shared'
import { sitemapIndexXml } from '../utils/seo'

export default defineEventHandler(async event => {
  const cfg = useRuntimeConfig(event)
  const blog = String(cfg.public.blogUrl ?? '').replace(/\/$/, '')
  // how many files the blog's sitemap has comes from the same numbers the blog site uses
  const meta = blog ? await $fetch<SitemapMeta>(`${cfg.apiInternal}/api/sitemap-data`).catch(() => ({ articles: 0, taxonomy: 0 })) : { articles: 0, taxonomy: 0 }
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, s-maxage=600')
  return sitemapIndexXml(getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin, blog, blogSitemapNames(meta))
})
