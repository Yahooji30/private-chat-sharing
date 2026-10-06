import type { Socket } from 'socket.io'

/** Token bucket per socket: 20 events/s, burst 40. Returns false when limited. */
export function limiter(socket: Socket, rate = 20, burst = 40): () => boolean {
  let tokens = burst, last = Date.now()
  void socket
  return () => {
    const now = Date.now()
    tokens = Math.min(burst, tokens + ((now - last) / 1000) * rate)
    last = now
    if (tokens < 1) return false
    tokens -= 1
    return true
  }
}

export function parseCookie(header: string | undefined, name: string): string {
  if (!header) return ''
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return ''
}

export function clientIp(socket: Socket): string {
  const xff = socket.handshake.headers['x-forwarded-for']
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim()
  return first || socket.handshake.address
}
