// Google AdSense verification file, served at /ads.txt. Set NUXT_PUBLIC_ADSENSE_CLIENT (ca-pub-123...) to enable it.
export default defineEventHandler(event => {
  const client = String(useRuntimeConfig().public.adsenseClient ?? '').replace(/^ca-/, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return client ? `google.com, ${client}, DIRECT, f08c47fec0942fa0\n` : '# Set NUXT_PUBLIC_ADSENSE_CLIENT to publish your AdSense line here.\n'
})
