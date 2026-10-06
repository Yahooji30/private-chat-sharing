import { createHmac } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { Emitter } from '@socket.io/redis-emitter'
import { hash, verify } from '@node-rs/argon2'
import { ERR, roomCreateSchema, roomManageSchema, roomCodeSchema, ticketSchema } from '@sync/shared'
import { env } from '../../core/config/env'
import { sql } from '../../core/db/client'
import { AppError } from '../../core/lib/errors'
import { base32, hashIp, randomToken, safeEqualHex, sha256 } from '../../core/lib/crypto'
import { K } from '../../core/redis/keys'

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }
const normCode = (c: string): string => roomCodeSchema.parse(c).toUpperCase()
const fakeSalt = (code: string): string => createHmac('sha256', env.IP_PEPPER).update(`salt:${code}`).digest().subarray(0, 16).toString('base64')

interface Room { code: string; kdf_salt: Buffer; auth_hash: string; manage_token_hash: string }

export function chatRoutes(app: FastifyInstance): void {
  const room = async (code: string): Promise<Room | undefined> => (await sql<Room[]>`select * from chat_rooms where code = ${code}`)[0]
  const closeRoom = async (code: string): Promise<void> => {
    await app.redis.del(K.chatSlots(code), K.chatMsgs(code), K.chatMeta(code))
    const chat = new Emitter(app.redis).of('/chat')
    chat.in(`chat:${code}`).emit('chat:closed', { reason: 'closed' })
    chat.in(`chat:${code}`).disconnectSockets()
  }

  app.post('/api/chat/rooms', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async req => {
    const b = roomCreateSchema.parse(req.body)
    const code = b.code ? b.code.toUpperCase() : base32(8)
    const manageToken = randomToken(), authHash = await hash(b.authKey, ARGON)
    const ins = await sql`insert into chat_rooms (code, kdf_salt, auth_hash, manage_token_hash)
      values (${code}, ${Buffer.from(b.kdfSalt, 'base64')}, ${authHash}, ${sha256(manageToken)}) on conflict do nothing returning code`
    if (!ins.length) throw new AppError(ERR.ROOM_EXISTS, 'That room code is taken', 409)
    return { code, url: `/c/${code}`, manageToken }
  })

  app.get<{ Params: { code: string } }>('/api/chat/rooms/:code/salt', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async req => {
    const code = normCode(req.params.code)
    const r = await room(code)
    return { kdfSalt: r ? r.kdf_salt.toString('base64') : fakeSalt(code) }
  })

  app.post<{ Params: { code: string } }>('/api/chat/rooms/:code/ticket', async req => {
    const code = normCode(req.params.code)
    const { authKey } = ticketSchema.parse(req.body)
    const ip = hashIp(req.ip) ?? 'unknown'
    const [a, g] = await Promise.all([bump(K.chatLock(ip, code), 900), bump(K.chatLockG(ip), 3600)])
    if (a > 5 || g > 30) throw new AppError(ERR.ROOM_LOCKED, 'Too many attempts, try again in 15 minutes', 429)
    const r = await room(code)
    if (!r || !await verify(r.auth_hash, authKey).catch(() => false)) throw new AppError(ERR.ROOM_BAD_AUTH, 'Wrong password', 401)
    await app.redis.del(K.chatLock(ip, code))
    const ticket = randomToken()
    await app.redis.set(K.chatTicket(sha256(ticket)), code, 'EX', 60)
    return { ticket }
  })

  app.post<{ Params: { code: string } }>('/api/chat/rooms/:code/manage', async req => {
    const code = normCode(req.params.code)
    const b = roomManageSchema.parse(req.body)
    const r = await room(code)
    if (!r || !safeEqualHex(sha256(b.manageToken), r.manage_token_hash)) throw new AppError(ERR.FORBIDDEN, 'Not allowed', 403)
    if (b.action === 'delete') await sql`delete from chat_rooms where code = ${code}`
    else await sql`update chat_rooms set kdf_salt = ${Buffer.from(b.kdfSalt, 'base64')}, auth_hash = ${await hash(b.authKey, ARGON)} where code = ${code}`
    await closeRoom(code)
    return { ok: true }
  })

  async function bump(key: string, ttl: number): Promise<number> {
    const n = await app.redis.incr(key)
    if (n === 1) await app.redis.expire(key, ttl)
    return n
  }
}
