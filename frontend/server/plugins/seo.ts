import type { SeoEntry } from '@sync/shared'
import { applySeo } from '../utils/seo'

// The app is a SPA, so crawlers and link previews (WhatsApp, Facebook, X) only see the first HTML. This puts the admin's
// SEO tags (Admin > SEO) into that HTML for the pages that have them. The page itself keeps them current afterwards.
const PAGES: Record<string, string> = { '/': 'home', '/chat': 'chat' }
const TTL_MS = 60_000
let cache: { at: number; map: Record<string, SeoEntry> } = { at: 0, map: {} }

let inflight: Promise<void> | null = null
function refresh(apiInternal: string): Promise<void> {
  inflight ??= $fetch<Record<string, SeoEntry>>(`${apiInternal}/api/seo`, { timeout: 3000 })
    .then(map => { cache = { at: Date.now(), map } })
    .catch(() => { cache = { ...cache, at: Date.now() - TTL_MS + 10_000 } }) // keep the last good tags, look again in 10 s
    .finally(() => { inflight = null })
  return inflight
}
/** Fresh for a minute; after that the old tags are served at once while a new copy is fetched, so a slow API never slows a page. */
async function seoMap(apiInternal: string): Promise<Record<string, SeoEntry>> {
  if (Date.now() - cache.at < TTL_MS) return cache.map
  const pending = refresh(apiInternal)
  if (cache.at === 0) await pending // nothing to show yet: wait for the first copy
  return cache.map
}

export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    const key = PAGES[event.path.split('?')[0]?.replace(/\/+$/, '') || '/'] ?? ''
    if (!key) return
    const cfg = useRuntimeConfig(event)
    const s = (await seoMap(String(cfg.apiInternal)))[key]
    if (!s) return
    html.head = [applySeo(html.head.join(''), s, String(cfg.public.blogUrl ?? '').replace(/\/$/, ''))]
  })
})
