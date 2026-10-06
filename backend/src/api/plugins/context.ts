import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'
import { isProd } from '../../core/config/env'
import { AppError } from '../../core/lib/errors'
import { resolveSpace, type Resolved } from '../../core/space'

declare module 'fastify' {
  interface FastifyRequest { ctx: Resolved }
  interface FastifyInstance { redis: Redis; routeTable: string[] }
  interface FastifyContextConfig { space?: boolean }
}

export const DEVICE_COOKIE = 'sid_dev'
export const SPACE = { config: { space: true } } as const

/** Routes declared with SPACE get req.ctx (space + device) and the device cookie. */
export function registerContext(app: FastifyInstance): void {
  app.decorateRequest('ctx')
  app.addHook('preHandler', async (req, reply) => {
    if (!req.routeOptions.config.space) return
    let cookie = req.cookies[DEVICE_COOKIE]
    if (!cookie) {
      cookie = randomBytes(16).toString('hex')
      reply.setCookie(DEVICE_COOKIE, cookie, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 400 * 86400 })
    }
    const r = await resolveSpace(app.redis, req.ip, cookie, req.headers['user-agent'] ?? '')
    if (!r) throw new AppError('BAD_REQUEST', 'Cannot resolve network', 400)
    req.ctx = r
  })
}
