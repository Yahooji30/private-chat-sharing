import { env } from '../config/env'

/** Asks the Nuxt server to drop its cached pages. Fire and forget: a failure only delays freshness. */
export function revalidate(): void {
  if (!env.NUXT_INTERNAL_URL || !env.REVALIDATE_SECRET) return
  void fetch(`${env.NUXT_INTERNAL_URL}/_revalidate`, { method: 'POST', headers: { 'x-revalidate-secret': env.REVALIDATE_SECRET }, signal: AbortSignal.timeout(3000) }).catch(() => undefined)
}
