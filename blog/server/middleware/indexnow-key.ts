import { apiGet } from '../utils/site'

/**
 * IndexNow key file at https://<blog>/<key>.txt (search engines open it to check that the key we send belongs to this site).
 * The address contains the key, so it cannot be a fixed route: this runs first, answers only when the file name is exactly the key,
 * and lets every other request carry on to the blog pages.
 */
const SHAPE = /^\/([A-Za-z0-9-]{8,128})\.txt$/
let cached: { key: string; at: number } | null = null

export default defineEventHandler(async event => {
  const m = SHAPE.exec(event.path.split('?')[0] ?? '')
  if (!m) return
  if (!cached || Date.now() - cached.at > 60_000) cached = { key: await apiGet<string>(event, '/indexnow-key').then(String, () => ''), at: Date.now() }
  if (!cached.key || cached.key !== m[1]) return // not the key: an ordinary 404 from the blog
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')
  return cached.key
})
