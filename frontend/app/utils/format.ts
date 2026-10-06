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

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/gi

export function findUrls(text: string): string[] {
  return [...new Set(text.match(URL_RE) ?? [])].slice(0, 100)
}

export const hrefOf = (u: string): string => (/^https?:\/\//i.test(u) ? u : `https://${u}`)
