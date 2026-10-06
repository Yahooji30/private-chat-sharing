import type { FastifyInstance } from 'fastify'
import { Emitter } from '@socket.io/redis-emitter'
import { ERR, linkIpSchema, linkRedeemSchema } from '@sync/shared'
import { env } from '../../core/config/env'
import { sql } from '../../core/db/client'
import { deviceRoom, ipRoom, spaceRoom } from '../../core/emitter'
import { AppError } from '../../core/lib/errors'
import { base32, hashIp, sha256 } from '../../core/lib/crypto'
import { isPrivateOrReserved, normalizeIp } from '../../core/lib/ip'
import { K } from '../../core/redis/keys'
import { invalidateDevice, invalidateIp } from '../../core/space'
import { SPACE } from '../plugins/context'

const CODE_TTL = 300
const MAX_ACTIVE = 3
const redeemLimit = { rateLimit: { max: 5, timeWindow: '1 minute' } }

export function linkRoutes(app: FastifyInstance): void {
  const space = () => new Emitter(app.redis).of('/space')

  app.post('/api/link/code', SPACE, async req => {
    const { spaceId, device } = req.ctx
    const n = await app.redis.incr(K.linkN(spaceId))
    if (n === 1) await app.redis.expire(K.linkN(spaceId), CODE_TTL)
    if (n > MAX_ACTIVE) throw new AppError(ERR.LINK_LIMIT, 'Too many active codes, wait a few minutes', 429)
    const code = base32(8)
    await app.redis.set(K.link(sha256(code)), JSON.stringify({ spaceId, by: device.id }), 'EX', CODE_TTL)
    return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt: Date.now() + CODE_TTL * 1000, url: `${env.PUBLIC_ORIGIN}/link?c=${code}` }
  })

  app.post('/api/link/redeem', { ...SPACE, config: { space: true, ...redeemLimit } }, async req => {
    const { code } = linkRedeemSchema.parse(req.body)
    const lk = K.link(sha256(code))
    const raw = ((await app.redis.multi().get(lk).del(lk).exec()) ?? [])[0]?.[1] as string | null | undefined
    if (!raw) throw new AppError(ERR.LINK_INVALID, 'Code is invalid or expired', 400)
    const { spaceId } = JSON.parse(raw) as { spaceId: string }
    await sql`update devices set space_id = ${spaceId}, linked_at = now() where id = ${req.ctx.device.id}`
    await invalidateDevice(app.redis, req.ctx.device.id)
    space().to(spaceRoom(spaceId)).emit('link:joined', { deviceId: req.ctx.device.id })
    space().in(deviceRoom(req.ctx.device.id)).disconnectSockets()
    return { ok: true }
  })

  app.get('/api/link/list', SPACE, async req => {
    const { spaceId, device } = req.ctx
    const devices = await sql<{ id: string; name: string; type: string; linked_at: Date; last_seen_at: Date }[]>`
      select id, name, type, linked_at, last_seen_at from devices where space_id = ${spaceId} order by linked_at`
    const nets = await sql<{ ip_hash: string; created_at: Date }[]>`
      select ip_hash, created_at from space_ips where space_id = ${spaceId} and kind = 'alias' order by created_at`
    return {
      devices: devices.map(d => ({ id: d.id, name: d.name, type: d.type, linkedAt: d.linked_at.getTime(), lastSeenAt: d.last_seen_at.getTime(), self: d.id === device.id })),
      networks: nets.map((n, i) => ({ id: n.ip_hash.slice(0, 16), label: `Network #${i + 1}`, addedAt: n.created_at.getTime() })),
      selfLinked: device.linked,
    }
  })

  app.delete<{ Params: { id: string } }>('/api/link/device/:id', SPACE, async req => {
    const r = await sql`update devices set space_id = null, linked_at = null where id = ${req.params.id} and space_id = ${req.ctx.spaceId} and linked_at is not null returning id`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Device not found', 404)
    await invalidateDevice(app.redis, req.params.id)
    space().in(deviceRoom(req.params.id)).emit('link:revoked', {})
    space().in(deviceRoom(req.params.id)).disconnectSockets()
    space().to(spaceRoom(req.ctx.spaceId)).emit('link:joined', {})
    return { ok: true }
  })

  app.post('/api/link/ip', SPACE, async req => {
    const { ip } = linkIpSchema.parse(req.body)
    const norm = normalizeIp(ip)
    if (!norm || isPrivateOrReserved(norm)) throw new AppError(ERR.IP_INVALID, 'Enter a valid public IP address', 400)
    const h = hashIp(ip) as string
    await sql`insert into space_ips (ip_hash, space_id, kind) values (${h}, ${req.ctx.spaceId}, 'alias')
      on conflict (ip_hash) do update set space_id = excluded.space_id, kind = 'alias'`
    await invalidateIp(app.redis, h)
    space().in(ipRoom(h)).disconnectSockets()
    space().to(spaceRoom(req.ctx.spaceId)).emit('link:joined', {})
    return { ok: true }
  })

  app.get<{ Querystring: { ip?: string } }>('/api/link/check', SPACE, async req => {
    const h = req.query.ip ? hashIp(req.query.ip) : null
    if (!h) throw new AppError(ERR.IP_INVALID, 'Enter a valid IP address', 400)
    const [r] = await sql`select 1 from space_ips where ip_hash = ${h} and space_id = ${req.ctx.spaceId}`
    return { linked: !!r }
  })

  app.delete<{ Params: { id: string } }>('/api/link/ip/:id', SPACE, async req => {
    if (!/^[0-9a-f]{16}$/.test(req.params.id)) throw new AppError(ERR.BAD_REQUEST, 'Bad id', 400)
    const rows = await sql<{ ip_hash: string }[]>`delete from space_ips where space_id = ${req.ctx.spaceId} and kind = 'alias' and ip_hash like ${req.params.id + '%'} returning ip_hash`
    if (!rows.length) throw new AppError(ERR.NOT_FOUND, 'Network not found', 404)
    for (const r of rows) { await invalidateIp(app.redis, r.ip_hash); space().in(ipRoom(r.ip_hash)).disconnectSockets() }
    space().to(spaceRoom(req.ctx.spaceId)).emit('link:joined', {})
    return { ok: true }
  })
}
