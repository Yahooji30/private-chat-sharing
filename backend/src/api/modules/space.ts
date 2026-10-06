import type { FastifyInstance } from 'fastify'
import { DEFAULT_SETTINGS, deviceRenameSchema, settingsSchema } from '@sync/shared'
import { env } from '../../core/config/env'
import { spaceEmitter, spaceRoom } from '../../core/emitter'
import { listFiles } from '../../core/files'
import { sql } from '../../core/db/client'
import { getSettings, putSettings } from '../../core/settings'
import { invalidateDevice } from '../../core/space'
import { readText } from '../../core/text'
import { createHmac } from 'node:crypto'
import { K } from '../../core/redis/keys'
import { SPACE } from '../plugins/context'

export function spaceRoutes(app: FastifyInstance): void {
  app.get('/api/space/me', SPACE, async req => ({
    appName: env.APP_NAME,
    rtUrl: env.RT_PUBLIC_URL,
    device: req.ctx.device,
    ip: displayIp(req.ip),
    settings: await getSettings(req.ctx.spaceId),
  }))
  app.get('/api/text', SPACE, req => readText(app.redis, req.ctx.spaceId))
  app.get('/api/files', SPACE, req => listFiles(req.ctx.spaceId))
  app.get('/api/settings', SPACE, req => getSettings(req.ctx.spaceId))
  app.put('/api/settings', SPACE, async req => {
    const s = settingsSchema.parse(req.body)
    await putSettings(req.ctx.spaceId, s)
    spaceEmitter(app.redis).to(spaceRoom(req.ctx.spaceId)).emit('settings:changed', s)
    return s
  })
  app.patch('/api/device', SPACE, async req => {
    const { name } = deviceRenameSchema.parse(req.body)
    await sql`update devices set name = ${name} where id = ${req.ctx.device.id}`
    await invalidateDevice(app.redis, req.ctx.device.id)
    spaceEmitter(app.redis).to(spaceRoom(req.ctx.spaceId)).emit('presence:rename', { deviceId: req.ctx.device.id, name })
    return { name }
  })
  app.get('/api/rtc/ice', SPACE, req => iceServers(req.ctx.device.id))
  if (env.NODE_ENV !== 'production') {
    // Dev/test only: wipes the caller's text and files so e2e runs start clean.
    app.post('/api/dev/reset-admin-locks', async () => {
      const keys = [...await app.redis.keys('adm:lock*'), ...await app.redis.keys('chat:lock*'), ...await app.redis.keys('rl:*')]
      if (keys.length) await app.redis.del(...keys)
      return { cleared: keys.length }
    })
    app.post('/api/dev/reset', SPACE, async req => {
      const id = req.ctx.spaceId
      await sql`delete from file_entries where space_id = ${id}`
      await sql`delete from space_text where space_id = ${id}`
      await sql`delete from space_settings where space_id = ${id}`
      await sql`delete from public_pages where owner_space_id = ${id}`
      await app.redis.del(K.text(id), K.linkN(id))
      const ns = spaceEmitter(app.redis).to(spaceRoom(id))
      ns.emit('files:cleared', {})
      ns.emit('settings:changed', DEFAULT_SETTINGS)
      ns.emit('text:changed', { content: '', rev: 0, by: 'reset' })
      return { ok: true }
    })
  }
  app.get('/api/health', async () => {
    const [pg, redis] = await Promise.all([sql`select 1`.then(() => true, () => false), app.redis.ping().then(() => true, () => false)])
    return { ok: pg && redis, pg, redis, uptime: Math.round(process.uptime()), rssMb: Math.round(process.memoryUsage().rss / 1048576) }
  })
}

const displayIp = (ip: string): string => ip.replace(/^::ffff:/i, '')

function iceServers(deviceId: string): { iceServers: { urls: string[]; username?: string; credential?: string }[] } {
  const list: { urls: string[]; username?: string; credential?: string }[] = [{ urls: env.STUN_URLS.split(',').filter(Boolean) }]
  if (env.TURN_ENABLED && env.TURN_SECRET && env.TURN_URLS) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${deviceId.slice(0, 16)}`
    list.push({ urls: env.TURN_URLS.split(','), username, credential: createHmac('sha1', env.TURN_SECRET).update(username).digest('base64') })
  }
  return { iceServers: list }
}
