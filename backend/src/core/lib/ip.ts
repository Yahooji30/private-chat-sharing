import { isIP } from 'node:net'

export function normalizeIp(raw: string): string | null {
  let ip = raw.trim().toLowerCase()
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip)
  if (mapped?.[1]) ip = mapped[1]
  const v = isIP(ip)
  if (v === 4) return ip
  if (v !== 6) return null
  return ipv6Prefix64(ip)
}

function ipv6Prefix64(ip: string): string {
  const [head = '', tail = ''] = ip.split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const full = ip.includes('::') ? [...h, ...Array<string>(8 - h.length - t.length).fill('0'), ...t] : h
  return full.slice(0, 4).map(g => g.padStart(4, '0')).join(':')
}

export function isPrivateOrReserved(ip: string): boolean {
  if (ip.includes(':')) return /^(0000:0000:0000:0000|fe[89ab]|f[cd]|ff)/.test(ip) || ip.startsWith('2001:0db8')
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51) || (a === 203 && b === 0)
}
