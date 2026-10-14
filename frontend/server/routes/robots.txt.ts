import { robotsTxt } from '../utils/seo'

export default defineEventHandler(event => {
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return robotsTxt(getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin, String(cfg.public.blogUrl ?? '').replace(/\/$/, ''))
})
