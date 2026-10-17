import { timingSafeEqual } from 'node:crypto'

// Called by the API after content changes: drops every cached (swr) page so edits show up at once.
export default defineEventHandler(async event => {
  const secret = useRuntimeConfig(event).revalidateSecret as string
  const sent = getHeader(event, 'x-revalidate-secret') ?? ''
  // compared in constant time, so the secret cannot be found out by timing the answers
  const same = sent.length === secret.length && timingSafeEqual(Buffer.from(sent), Buffer.from(secret))
  if (!secret || !same) throw createError({ statusCode: 403 })
  const cache = useStorage('cache')
  const keys = await cache.getKeys('nitro')
  await Promise.all(keys.map(k => cache.removeItem(k)))
  return { purged: keys.length }
})
