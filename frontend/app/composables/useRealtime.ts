import { io, type Socket } from 'socket.io-client'

let space: Socket | null = null

/** Single shared `/space` socket for the whole app (client only). */
export function spaceSocket(): Socket {
  if (space) return space
  const rt = useRuntimeConfig().public.rtUrl as string
  space = io(`${rt || ''}/space`, { transports: ['websocket'], withCredentials: true, reconnectionDelayMax: 5000 })
  const app = useApp()
  space.on('connect', () => { app.online = true })
  space.on('disconnect', reason => { app.online = false; if (reason === 'io server disconnect') space?.connect() })
  space.on('presence:list', (l: Peer[]) => { app.peers = l })
  space.on('presence:rename', (m: { deviceId: string; name: string }) => { app.peers = app.peers.map(p => (p.deviceId === m.deviceId ? { ...p, name: m.name } : p)) })
  space.on('settings:changed', (s: typeof app.settings) => { app.settings = s })
  space.on('link:revoked', () => { location.href = '/' })
  space.on('link:joined', () => { window.dispatchEvent(new Event('sync:linked-changed')) })
  return space
}

export function emitAck<T = { ok?: boolean; error?: string }>(ev: string, data: unknown): Promise<T> {
  return spaceSocket().timeout(5000).emitWithAck(ev, data).catch(() => ({ error: 'TIMEOUT' }) as T)
}

export function chatSocket(auth: Record<string, unknown>): Socket {
  const rt = useRuntimeConfig().public.rtUrl as string
  return io(`${rt || ''}/chat`, { transports: ['websocket'], withCredentials: true, auth, reconnection: false })
}
