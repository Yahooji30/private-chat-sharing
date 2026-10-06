// Called by the API after content changes: drops every cached (swr) page so edits show up at once.
export default defineEventHandler(async event => {
  const secret = useRuntimeConfig(event).revalidateSecret as string
  if (!secret || getHeader(event, 'x-revalidate-secret') !== secret) throw createError({ statusCode: 403 })
  const cache = useStorage('cache')
  const keys = await cache.getKeys('nitro')
  await Promise.all(keys.map(k => cache.removeItem(k)))
  return { purged: keys.length }
})
