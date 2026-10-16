import { apiGet } from '../utils/site'

/** The IndexNow key file: search engines open it to check that the key we send belongs to this site. */
export default defineEventHandler(async event => {
  const key = await apiGet<string>(event, '/indexnow-key').catch(() => '')
  if (!key) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return String(key)
})
