import { io, type Socket } from 'socket.io-client'

let space: Socket | null = null

/** Realtime base URL: configured, or in development the realtime port on the same host (works from phones on the LAN too). */
function rtBase(): string {
  const cfg = useRuntimeConfig().public.rtUrl as string
  if (cfg) return cfg
  return import.meta.dev ? `${location.protocol}//${location.hostname}:4001` : ''
}

/** Single shared `/space` socket for the whole app (client only). */
export function spaceSocket(): Socket {
  if (space) return space
  space = io(`${rtBase()}/space`, { transports: ['websocket'], withCredentials: true, reconnectionDelayMax: 5000 })
  const app = useApp()
  space.on('connect', () => { app.online = true; app.hasConnected = true })
  space.on('disconnect', reason => { app.online = false; if (reason === 'io server disconnect') space?.connect() })
  space.on('presence:list', (l: Peer[]) => { app.peers = l })
  space.on('presence:rename', (m: { deviceId: string; name: string }) => { app.peers = app.peers.map(p => (p.deviceId === m.deviceId ? { ...p, name: m.name } : p)) })
  space.on('settings:changed', (s: typeof app.settings) => { app.settings = s })
  // browsers can hold a dead socket for ~45 s after the network drops: react to the OS signal at once
  window.addEventListener('offline', () => { app.online = false; space?.disconnect() })
  window.addEventListener('online', () => { space?.connect() })
  space.on('link:revoked', () => { location.href = '/' })
  space.on('link:joined', () => { window.dispatchEvent(new Event('sync:linked-changed')) })
  return space
}

export function emitAck<T = { ok?: boolean; error?: string }>(ev: string, data: unknown): Promise<T> {
  return spaceSocket().timeout(5000).emitWithAck(ev, data).catch(() => ({ error: 'TIMEOUT' }) as T)
}

export function chatSocket(auth: Record<string, unknown>): Socket {
  return io(`${rtBase()}/chat`, { transports: ['websocket'], withCredentials: true, auth, reconnection: false })
}
