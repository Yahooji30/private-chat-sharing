import type { SeoEntry } from '@sync/shared'

// The admin's SEO entries (Admin > SEO), fetched from the API and kept for a minute.
const TTL_MS = 60_000
let cache: { at: number; map: Record<string, SeoEntry> } = { at: 0, map: {} }
let inflight: Promise<void> | null = null

function refresh(apiInternal: string): Promise<void> {
  inflight ??= $fetch<Record<string, SeoEntry>>(`${apiInternal}/api/seo`, { timeout: 3000 })
    .then(map => { cache = { at: Date.now(), map } })
    .catch(() => { cache = { ...cache, at: Date.now() - TTL_MS + 10_000 } }) // keep the last good copy, look again in 10 s
    .finally(() => { inflight = null })
  return inflight
}

/** Fresh for a minute; after that the old copy is served at once while a new one is fetched, so a slow API never slows a page. */
export async function getSeoMap(apiInternal: string): Promise<Record<string, SeoEntry>> {
  if (Date.now() - cache.at < TTL_MS) return cache.map
  const pending = refresh(apiInternal)
  if (cache.at === 0) await pending // nothing to show yet: wait for the first copy
  return cache.map
}
