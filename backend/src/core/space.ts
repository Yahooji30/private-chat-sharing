import { randomBytes } from 'node:crypto'
import type { Redis } from 'ioredis'
import { sql } from './db/client'
import { hashIp, sha256, base32 } from './lib/crypto'
import { deviceType, randomDeviceName } from './lib/names'
import { K } from './redis/keys'

export interface DeviceInfo { id: string; name: string; type: string; linked: boolean }
export interface Resolved { spaceId: string; device: DeviceInfo }

const CACHE_TTL = 300

async function spaceForIp(redis: Redis, ipHash: string): Promise<string> {
  const cached = await redis.get(K.ipCache(ipHash))
  if (cached) return cached
  let [row] = await sql<{ space_id: string }[]>`select space_id from space_ips where ip_hash = ${ipHash}`
  if (!row) {
    const id = base32(16)
    await sql.begin(async tx => {
      await tx`insert into spaces (id, salt) values (${id}, ${randomBytes(32)})`
      await tx`insert into space_ips (ip_hash, space_id, kind) values (${ipHash}, ${id}, 'default') on conflict do nothing`
    })
    ;[row] = await sql<{ space_id: string }[]>`select space_id from space_ips where ip_hash = ${ipHash}`
    await sql`delete from spaces s where s.id = ${id} and not exists (select 1 from space_ips i where i.space_id = s.id)`
  }
  const id = (row as { space_id: string }).space_id
  await redis.set(K.ipCache(ipHash), id, 'EX', CACHE_TTL)
  await sql`update spaces set last_active_at = now() where id = ${id}`
  return id
}

async function loadDevice(redis: Redis, devHash: string, ua: string): Promise<{ spaceId: string | null; name: string; type: string }> {
  const cached = await redis.get(K.devCache(devHash))
  if (cached) {
    const [s = '', name = '', type = ''] = cached.split('|')
    return { spaceId: s || null, name, type }
  }
  let [d] = await sql<{ space_id: string | null; name: string; type: string }[]>`select space_id, name, type from devices where id = ${devHash}`
  if (!d) {
    const name = randomDeviceName(), type = deviceType(ua)
    await sql`insert into devices (id, name, type) values (${devHash}, ${name}, ${type}) on conflict do nothing`
    ;[d] = await sql<{ space_id: string | null; name: string; type: string }[]>`select space_id, name, type from devices where id = ${devHash}`
  }
  const dev = d as { space_id: string | null; name: string; type: string }
  await redis.set(K.devCache(devHash), `${dev.space_id ?? ''}|${dev.name}|${dev.type}`, 'EX', CACHE_TTL)
  return { spaceId: dev.space_id, name: dev.name, type: dev.type }
}

export async function resolveSpace(redis: Redis, ip: string, deviceCookie: string, ua: string): Promise<Resolved | null> {
  const ipHash = hashIp(ip)
  if (!ipHash || deviceCookie.length < 16) return null
  const devHash = sha256(deviceCookie)
  const dev = await loadDevice(redis, devHash, ua)
  const spaceId = dev.spaceId ?? await spaceForIp(redis, ipHash)
  return { spaceId, device: { id: devHash, name: dev.name, type: dev.type, linked: dev.spaceId !== null } }
}

export const invalidateIp = (redis: Redis, ipHash: string) => redis.del(K.ipCache(ipHash))
export const invalidateDevice = (redis: Redis, devHash: string) => redis.del(K.devCache(devHash))
