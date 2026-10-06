import { createServer } from 'node:http'
import { createAdapter } from '@socket.io/redis-adapter'
import { Server } from 'socket.io'
import { env } from '../core/config/env'
import { sql } from '../core/db/client'
import { newRedis } from '../core/redis/client'
import { flushDirty } from '../core/text'
import { setupChat } from './chat'
import { setupSpace } from './space'

export async function buildRt() {
  const redis = newRedis(), pub = newRedis(), sub = newRedis()
  const http = createServer((_req, res) => { res.writeHead(404).end() })
  const io = new Server(http, {
    transports: ['websocket'], maxHttpBufferSize: 1_000_000, serveClient: false,
    cors: { origin: env.PUBLIC_ORIGIN, credentials: true },
  })
  io.adapter(createAdapter(pub, sub))
  setupSpace(io.of('/space'), redis)
  const chat = setupChat(io.of('/chat'), redis)
  const stat = async (): Promise<void> => {
    const [space, chatN] = await Promise.all([io.of('/space').local.fetchSockets(), io.of('/chat').local.fetchSockets()])
    const k = `rt:stats:${process.pid}`
    await redis.hset(k, { space: new Set(space.map(s => (s.data as { deviceId: string }).deviceId)).size, chat: chatN.length })
    await redis.expire(k, 15)
  }
  const timers = [
    setInterval(() => void stat().catch(() => undefined), 5000),
    setInterval(() => void flushDirty(redis).catch(() => undefined), env.TEXT_FLUSH_MS),
    setInterval(() => void chat.sweep().catch(() => undefined), 10_000),
  ]
  const close = async (): Promise<void> => {
    timers.forEach(clearInterval)
    await flushDirty(redis, 10_000).catch(() => undefined)
    await io.close()
    await Promise.all([redis.quit(), pub.quit(), sub.quit()])
    await sql.end()
  }
  return { http, io, close, sweepChat: chat.sweep }
}
