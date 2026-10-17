import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZodError } from 'zod'
import { env, isProd } from '../core/config/env'
import { sql } from '../core/db/client'
import { AppError } from '../core/lib/errors'
import { hashIp } from '../core/lib/crypto'
import { parseTrust } from '../core/lib/proxy'
import { newRedis } from '../core/redis/client'
import { K } from '../core/redis/keys'
import { adminAuth } from './modules/admin/auth'
import { contentRoutes } from './modules/admin/content'
import { adminEngageRoutes } from './modules/admin/engage'
import { mediaRoutes } from './modules/admin/media'
import { opsRoutes } from './modules/admin/ops'
import { blogRoutes } from './modules/blog'
import { chatRoutes } from './modules/chat'
import { engageRoutes } from './modules/engage'
import { linkRoutes } from './modules/link'
import { pageRoutes } from './modules/pages'
import { spaceRoutes } from './modules/space'
import { registerContext } from './plugins/context'

export async function buildApi() {
  const redis = newRedis()
  const app = Fastify({
    logger: { level: isProd ? 'info' : 'warn', redact: ['req.headers.cookie', 'req.headers.authorization', 'req.remoteAddress'] },
    trustProxy: parseTrust(env.TRUST_PROXY) as boolean /* a number (hops) or address list also works at runtime */, bodyLimit: 256 * 1024,
  })
  app.decorate('redis', redis)
  const routeTable: string[] = []
  app.addHook('onRoute', r => { for (const m of [r.method].flat()) routeTable.push(`${m} ${r.url}`) })
  app.decorate('routeTable', routeTable)
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cookie, { secret: env.COOKIE_SECRET })
  await app.register(rateLimit, {
    global: true, max: 300, timeWindow: '1 minute', redis, nameSpace: K.rl,
    keyGenerator: req => hashIp(req.ip) ?? req.ip, skipOnError: true,
  })
  registerContext(app)
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: { code: err.code, message: (err as Error).message } })
    if (err instanceof ZodError) return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'Invalid input' } })
    const status = (err as { statusCode?: number }).statusCode ?? 500
    if (status === 429) return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } })
    if (status < 500) return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: (err as Error).message } })
    app.log.error(err)
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong' } })
  })
  spaceRoutes(app)
  linkRoutes(app)
  if (env.PUBLIC_PAGES) pageRoutes(app) // anonymous page hosting: off unless switched on (nothing in the apps uses it)
  chatRoutes(app)
  blogRoutes(app)
  engageRoutes(app)
  adminAuth(app)
  contentRoutes(app)
  adminEngageRoutes(app)
  mediaRoutes(app)
  opsRoutes(app)
  mkdirSync(resolve(env.MEDIA_DIR), { recursive: true })
  if (!isProd) await app.register((await import('@fastify/static')).default, { root: resolve(env.MEDIA_DIR), prefix: '/media/', decorateReply: false })
  app.addHook('onClose', async () => { await redis.quit(); await sql.end() })
  return app
}
