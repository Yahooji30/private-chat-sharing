import { env } from './config/env'

const ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * IndexNow: tells Bing, Yandex, Seznam and Naver at once that blog addresses were added, changed or removed, so they look at them now
 * instead of whenever they next come by. (Google does not use it; Google reads the sitemaps.) Off unless INDEXNOW_KEY and BLOG_ORIGIN
 * are set. Fire and forget: a failure only means the search engines find the change a little later.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  const origin = env.BLOG_ORIGIN.replace(/\/$/, '')
  if (!env.INDEXNOW_KEY || !origin || !paths.length) return
  try {
    await fetch(ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ host: new URL(origin).host, key: env.INDEXNOW_KEY, keyLocation: `${origin}/indexnow-key.txt`, urlList: [...new Set(paths)].slice(0, 10_000).map(p => origin + p) }),
    })
  } catch { /* the search engines will notice later */ }
}
