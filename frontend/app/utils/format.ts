export const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let i = -1
  do { n /= 1024; i++ } while (n >= 1024 && i < u.length - 1)
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${u[i]}`
}

export const fmtDuration = (s: number): string => {
  if (!isFinite(s) || s < 0) return '--'
  if (s < 60) return `${Math.ceil(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export const fmtAgo = (ts: number, now = Date.now()): string => {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  return `${Math.round(h / 24)} day${h >= 36 ? 's' : ''} ago`
}

export const fmtClock = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

const TLDS = new Set(('com org net edu gov mil int io co ai app dev me tv us uk in de fr es it nl be ch at se no dk fi pl cz ru ua jp cn kr hk tw sg au nz ca mx br ar cl pe za ng ke eg ae sa il tr ir pk bd lk id my th vn ph info biz xyz online site store shop tech cloud blog news live link page club top pro name mobi media agency studio design art wiki zone world today life one fm ly gl gg sh to cc ws vc im is ee lt lv gr pt ro hu bg hr rs si sk eu asia ink digital network systems software solutions email space website works run so tools team ac gd la').split(' '))
const URL_RE = /(?<![@\w./-])(?:https?:\/\/[^\s<>"'`]+|(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(?::\d{2,5})?(?:[/?#][^\s<>"'`]*)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?(?:[/?#][^\s<>"'`]*)?)/gi

const trimEnd = (u: string): string => {
  let v = u
  for (;;) {
    const c = v.at(-1) ?? ''
    if (/[.,;:!?'"*_]/.test(c)) v = v.slice(0, -1)
    else if (')]}'.includes(c) && c && v.split(c).length > v.split({ ')': '(', ']': '[', '}': '{' }[c] as string).length) v = v.slice(0, -1)
    else return v
  }
}

/** Real links only: a scheme, a www. host, or a bare domain with a known TLD. Rejects hosts like "www" or "file.txt". */
function valid(u: string): boolean {
  const hasScheme = /^https?:\/\//i.test(u)
  let host: string
  try { host = new URL(hasScheme ? u : `https://${u}`).hostname.toLowerCase() } catch { return false }
  if (host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return hasScheme || /^\d/.test(u)
  if (host.startsWith('[') || host.endsWith('.') || host.includes('..')) return hasScheme && host.startsWith('[')
  const labels = host.split('.')
  if (labels.length < 2) return false
  const tld = labels.at(-1) ?? ''
  if (!/^[a-z]{2,24}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return false
  if (labels.some(l => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) return false
  if (hasScheme || host.startsWith('www.')) return true
  return TLDS.has(tld)
}

export function findUrls(text: string): string[] {
  const seen = new Set<string>(), out: string[] = []
  for (const m of text.matchAll(URL_RE)) {
    const u = trimEnd(m[0])
    const key = hrefOf(u).replace(/\/$/, '').toLowerCase()
    if (!valid(u) || seen.has(key)) continue
    seen.add(key); out.push(u)
    if (out.length >= 100) break
  }
  return out
}

export const hrefOf = (u: string): string => (/^https?:\/\//i.test(u) ? u : `https://${u}`)
