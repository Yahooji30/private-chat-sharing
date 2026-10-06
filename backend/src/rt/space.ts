import type { Namespace, Socket } from 'socket.io'
import type { Redis } from 'ioredis'
import { EV, fileMetaSchema, fileIdSchema, fileReadySchema, rtcSignalSchema, textUpdateSchema } from '@sync/shared'
import { sql } from '../core/db/client'
import { deviceRoom, ipRoom, spaceRoom } from '../core/emitter'
import { hashIp } from '../core/lib/crypto'
import { addFile, addHolder, clearFiles, markReady, removeFile } from '../core/files'
import { resolveSpace } from '../core/space'
import { writeText } from '../core/text'
import { clientIp, limiter, parseCookie } from './common'

interface Data { spaceId: string; deviceId: string }
type Ack = (r: unknown) => void

export function setupSpace(ns: Namespace, redis: Redis): void {
  const timers = new Map<string, NodeJS.Timeout>()

  const presence = async (spaceId: string): Promise<void> => {
    const socks = await ns.in(spaceRoom(spaceId)).fetchSockets()
    const byDevice = new Map<string, { deviceId: string; name: string; type: string; since: number }>()
    for (const s of socks) {
      const d = s.data as Data & { name: string; type: string; since: number }
      const prev = byDevice.get(d.deviceId)
      byDevice.set(d.deviceId, { deviceId: d.deviceId, name: d.name, type: d.type, since: Math.max(prev?.since ?? 0, d.since) })
    }
    const ids = [...byDevice.keys()]
    const names = ids.length ? await sql<{ id: string; name: string }[]>`select id, name from devices where id in ${sql(ids)}` : []
    for (const n of names) { const d = byDevice.get(n.id); if (d) d.name = n.name }
    const list = [...byDevice.values()]
    for (const s of socks) {
      const self = (s.data as Data).deviceId
      s.emit(EV.presence, list.map(d => ({ ...d, self: d.deviceId === self })))
    }
  }
  const schedulePresence = (spaceId: string): void => {
    if (timers.has(spaceId)) return
    timers.set(spaceId, setTimeout(() => { timers.delete(spaceId); void presence(spaceId).catch(() => undefined) }, 250))
  }

  ns.use(async (socket, next) => {
    try {
      const cookie = parseCookie(socket.handshake.headers.cookie, 'sid_dev')
      const r = await resolveSpace(redis, clientIp(socket), cookie, socket.handshake.headers['user-agent'] ?? '')
      if (!r) return next(new Error('unauthorized'))
      Object.assign(socket.data, { since: Date.now(), ipHash: hashIp(clientIp(socket)) ?? '', spaceId: r.spaceId, deviceId: r.device.id, name: r.device.name, type: r.device.type })
      next()
    } catch { next(new Error('unauthorized')) }
  })

  ns.on('connection', (socket: Socket) => {
    const { spaceId, deviceId } = socket.data as Data
    const allow = limiter(socket)
    void socket.join([spaceRoom(spaceId), deviceRoom(deviceId), ipRoom((socket.data as { ipHash: string }).ipHash)])
    void sql`update devices set last_seen_at = now() where id = ${deviceId}`.catch(() => undefined)
    schedulePresence(spaceId)
    socket.on('disconnect', () => schedulePresence(spaceId))

    const on = <T>(ev: string, parse: (v: unknown) => T | null, fn: (v: T, ack: Ack) => Promise<void>): void => {
      socket.on(ev, (raw: unknown, ack?: Ack) => {
        const reply: Ack = typeof ack === 'function' ? ack : () => undefined
        if (!allow()) return reply({ error: 'RATE_LIMITED' })
        const v = parse(raw)
        if (v === null) return reply({ error: 'BAD_REQUEST' })
        fn(v, reply).catch(() => reply({ error: 'INTERNAL' }))
      })
    }
    const zod = <T>(s: { safeParse: (v: unknown) => { success: boolean; data?: T } }) => (v: unknown): T | null => {
      const r = s.safeParse(v)
      return r.success ? (r.data as T) : null
    }
    const toOthers = () => socket.to(spaceRoom(spaceId))

    on(EV.textUpdate, zod(textUpdateSchema), async (m, ack) => {
      const rev = await writeText(redis, spaceId, m.content)
      ack({ rev })
      toOthers().emit(EV.textChanged, { content: m.content, rev, by: deviceId })
    })

    on(EV.filesAdd, zod(fileMetaSchema), async (m, ack) => {
      const entry = await addFile(spaceId, deviceId, m)
      if (!entry) return ack({ error: 'FILE_LIMIT' })
      ack({ ok: true })
      ns.in(spaceRoom(spaceId)).emit(EV.filesAdded, [entry])
    })
    on(EV.filesReady, zod(fileReadySchema), async (m, ack) => {
      if (!await markReady(spaceId, deviceId, m.fileId, m.rootHash)) return ack({ error: 'FORBIDDEN' })
      ack({ ok: true })
      ns.in(spaceRoom(spaceId)).emit(EV.filesReady, m)
      ns.in(spaceRoom(spaceId)).emit(EV.filesHolders, { fileId: m.fileId, holders: [deviceId] })
    })
    on(EV.filesHolder, zod(fileIdSchema), async (m, ack) => {
      const holders = await addHolder(spaceId, deviceId, m.fileId)
      if (!holders) return ack({ error: 'NOT_FOUND' })
      ack({ ok: true })
      ns.in(spaceRoom(spaceId)).emit(EV.filesHolders, { fileId: m.fileId, holders })
    })
    on(EV.filesRemove, zod(fileIdSchema), async (m, ack) => {
      if (await removeFile(spaceId, m.fileId)) ns.in(spaceRoom(spaceId)).emit(EV.filesRemoved, { fileId: m.fileId })
      ack({ ok: true })
    })
    on(EV.filesClear, v => v ?? {}, async (_m, ack) => {
      await clearFiles(spaceId)
      ack({ ok: true })
      ns.in(spaceRoom(spaceId)).emit(EV.filesCleared, {})
    })

    on(EV.rtcSignal, zod(rtcSignalSchema), async (m, ack) => {
      const peers = await ns.in(spaceRoom(spaceId)).fetchSockets()
      if (!peers.some(p => (p.data as Data).deviceId === m.to)) return ack({ error: 'PEER_OFFLINE' })
      ns.in(deviceRoom(m.to)).emit(EV.rtcSignal, { from: deviceId, data: m.data })
      ack({ ok: true })
    })
  })
}
