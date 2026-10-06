import { env } from '../config/env'

/** Asks the Nuxt web server(s) (comma separated URLs) to drop cached pages. Fire and forget: a failure only delays freshness. */
export async function revalidate(): Promise<void> {
  if (!env.NUXT_INTERNAL_URL || !env.REVALIDATE_SECRET) return
  const bases = env.NUXT_INTERNAL_URL.split(',').map(u => u.trim()).filter(Boolean)
  await Promise.allSettled(bases.map(base => fetch(`${base}/_revalidate`, { method: 'POST', headers: { 'x-revalidate-secret': env.REVALIDATE_SECRET }, signal: AbortSignal.timeout(3000) })))
}
