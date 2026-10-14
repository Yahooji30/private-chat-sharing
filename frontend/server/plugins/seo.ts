import { applySeo, cleanPath, isKnownRoute, pageInfo, wantsPage } from '../utils/seo'
import { getSeoMap } from '../utils/seomap'

// The app is a single-page app, so crawlers and link previews (WhatsApp, Facebook, X) only see the first HTML the server sends.
// This puts each page's title, description and social tags into it (the admin's, from Admin > SEO, or the page's own), and
// answers addresses the app does not have with a real 404 instead of a page that says 200.
export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    const path = cleanPath(event.path)
    const cfg = useRuntimeConfig(event)
    const info = pageInfo(path, String(cfg.public.appName))
    if (!info) return
    const blogUrl = String(cfg.public.blogUrl ?? '').replace(/\/$/, '')
    const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
    const own = origin + (path === '/' ? '/' : path)
    const entry = (await getSeoMap(String(cfg.apiInternal)))[info.key]
    html.head = [applySeo(html.head.join(''), entry, blogUrl, {
      title: info.title, description: info.description, url: own,
      canonical: info.blogPath && blogUrl ? blogUrl + info.blogPath : own,
      image: `${origin}/og-image.jpg`,
    })]
  })

  nitroApp.hooks.hook('render:response', (response, { event }) => {
    const path = cleanPath(event.path)
    if (!isKnownRoute(path) && wantsPage(path, getRequestHeader(event, 'accept') ?? '')) response.statusCode = 404
  })
})
