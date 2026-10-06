import type { Namespace, Socket } from 'socket.io'
import type { Redis } from 'ioredis'
import { chatMsgSchema, chatResumeSchema, EV, LIMITS } from '@sync/shared'
import { env } from '../core/config/env'
import { sql } from '../core/db/client'
import { randomToken, sha256 } from '../core/lib/crypto'
import { K } from '../core/redis/keys'
import { CHAT_FREE, CHAT_JOIN, CHAT_SET_IF_EXISTS, evalLua } from '../core/redis/lua'
import { limiter } from './common'

interface Replay { id: string; slot: number; iv: string; ct: string }
interface Data { code: string; slot: number; closed?: boolean; left?: boolean; init: Record<string, unknown>; fresh: boolean; replay: Replay[] }
const room = (code: string) => `chat:${code}`
const keys = (c: string) => [K.chatSlots(c), K.chatMsgs(c), K.chatMeta(c)]
const shuffled = (): number[] => [0, 1, 2, 3].sort(() => Math.random() - 0.5)

export function setupChat(ns: Namespace, redis: Redis): { sweep: () => Promise<void> } {
  const state = async (code: string) => {
    const slots = await redis.hgetall(K.chatSlots(code))
    const palette = JSON.parse((await redis.hget(K.chatMeta(code), 'palette')) ?? '[0,1,2,3]') as number[]
    const occ = [0, 1, 2, 3].map(i => slots[String(i)] !== undefined)
    return { count: occ.filter(Boolean).length, slots: occ, palette }
  }
  const broadcast = async (code: string): Promise<void> => { ns.in(room(code)).emit(EV.chatMembers, await state(code)) }

  const free = async (code: string, slot: number): Promise<void> => {
    const left = Number(await evalLua(redis, CHAT_FREE, keys(code), [slot]))
    await redis.zrem(K.chatGrace, `${code}:${slot}`)
    if (left > 0) {
      ns.in(room(code)).emit(EV.chatSystem, { kind: 'left' })
      await broadcast(code)
    }
  }

  async function sweep(): Promise<void> {
    const due = await redis.zrangebyscore(K.chatGrace, '-inf', Date.now())
    for (const m of due) {
      if (!await redis.zrem(K.chatGrace, m)) continue
      const [code = '', slot = ''] = m.split(':')
      const v = await redis.hget(K.chatSlots(code), slot)
      if (v?.split('|')[1] === 'grace') await free(code, Number(slot))
    }
  }

  async function join(socket: Socket): Promise<Data | null> {
    const none: Pick<Data, 'replay'> = { replay: [] }
    const auth = socket.handshake.auth as Record<string, unknown>
    if (typeof auth.ticket === 'string') {
      const tk = K.chatTicket(sha256(auth.ticket))
      const code = ((await redis.multi().get(tk).del(tk).exec()) ?? [])[0]?.[1] as string | null | undefined
      if (!code) return null
      const token = randomToken()
      const r = await evalLua(redis, CHAT_JOIN, keys(code), [sha256(token), env.CHAT_IDLE_TTL_S, LIMITS.chatMaxMembers, JSON.stringify(shuffled())]) as [number, string?]
      if (r[0] < 0) throw new Error('full')
      void sql`update chat_rooms set last_active_at = now() where code = ${code}`.catch(() => undefined)
      await socket.join(room(code))
      const st = await state(code)
      const init = { ...st, slot: r[0], color: st.palette[r[0]] ?? r[0], resumeToken: token, lastId: r[1] ?? '0' }
      return { code, slot: r[0], init, fresh: true, ...none }
    }
    const rs = chatResumeSchema.safeParse(auth.resume)
    if (!rs.success) return null
    const { code, token, lastId } = rs.data
    const slots = await redis.hgetall(K.chatSlots(code.toUpperCase()))
    const hit = Object.entries(slots).find(([, v]) => v.split('|')[0] === sha256(token))
    if (!hit) return null
    const C = code.toUpperCase(), slot = Number(hit[0])
    await evalLua(redis, CHAT_SET_IF_EXISTS, [K.chatSlots(C)], [slot, `${sha256(token)}|live|0`])
    await redis.zrem(K.chatGrace, `${C}:${slot}`)
    await socket.join(room(C))
    const st = await state(C)
    const replay: Replay[] = []
    if (/^\d+-\d+$/.test(lastId)) {
      for (const [id, f] of await redis.xrange(K.chatMsgs(C), `(${lastId}`, '+')) {
        const o: Record<string, string> = {}
        for (let i = 0; i < f.length; i += 2) o[f[i] as string] = f[i + 1] as string
        replay.push({ id, slot: Number(o.slot), iv: o.iv ?? '', ct: o.ct ?? '' })
      }
    }
    const init = { ...st, slot, color: st.palette[slot] ?? slot, resumeToken: token, lastId: replay.at(-1)?.id ?? lastId }
    return { code: C, slot, init, fresh: false, replay }
  }

  ns.use(async (socket, next) => {
    try {
      const d = await join(socket)
      if (!d) return next(new Error('unauthorized'))
      Object.assign(socket.data, d)
      next()
    } catch (e) { next(new Error((e as Error).message === 'full' ? 'full' : 'unauthorized')) }
  })

  ns.on('connection', socket => {
    const d = socket.data as Data
    const allow = limiter(socket, 5, 10)
    socket.emit(EV.chatMembers, d.init)
    for (const m of d.replay) socket.emit(EV.chatMsg, m)
    if (d.fresh) socket.to(room(d.code)).emit(EV.chatSystem, { kind: 'joined' })
    void broadcast(d.code)
    socket.on(EV.chatMsg, async (raw: unknown, ack?: (r: unknown) => void) => {
      const m = chatMsgSchema.safeParse(raw)
      if (!m.success || !allow()) return ack?.({ error: 'REJECTED' })
      const id = await redis.xadd(K.chatMsgs(d.code), 'MAXLEN', '~', env.CHAT_MSG_CAP, '*', 'slot', d.slot, 'iv', m.data.iv, 'ct', m.data.ct)
      await redis.expire(K.chatMsgs(d.code), env.CHAT_IDLE_TTL_S)
      socket.to(room(d.code)).emit(EV.chatMsg, { id, slot: d.slot, ...m.data })
      ack?.({ id })
    })
    socket.on(EV.chatTyping, (raw: unknown) => {
      if (allow()) socket.to(room(d.code)).emit(EV.chatTyping, { slot: d.slot, on: raw === true || (raw as { on?: unknown })?.on === true })
    })
    socket.on(EV.chatLeave, async () => { d.left = true; socket.disconnect(true); await free(d.code, d.slot) })
    socket.on('disconnect', () => {
      if (d.left || d.closed) return
      void (async () => {
        const v = await redis.hget(K.chatSlots(d.code), String(d.slot))
        if (!v) return
        const hash = v.split('|')[0]
        await evalLua(redis, CHAT_SET_IF_EXISTS, [K.chatSlots(d.code)], [d.slot, `${hash}|grace|0`])
        await redis.zadd(K.chatGrace, Date.now() + env.CHAT_RESUME_GRACE_S * 1000, `${d.code}:${d.slot}`)
      })().catch(() => undefined)
    })
  })
  return { sweep }
}
