import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hash, verify } from '@node-rs/argon2'
import { generateSecret, generateURI, verifySync } from 'otplib'
import QRCode from 'qrcode'
import { adminCreateSchema, adminLoginSchema, adminTotpSchema, ERR, passwordSchema } from '@sync/shared'
import { z } from 'zod'
import { env, isProd } from '../../../core/config/env'
import { sql } from '../../../core/db/client'
import { AppError } from '../../../core/lib/errors'
import { base32, hashIp, open, randomToken, seal, sha256 } from '../../../core/lib/crypto'
import { K } from '../../../core/redis/keys'

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }
const SESSION_MS = 12 * 3600_000
const EXTEND_BELOW_MS = 6 * 3600_000
const LOCK_MAX = 5
const LOCK_TTL = 900
export interface Admin { id: string; email: string; name: string; role: 'owner' | 'admin'; totpEnabled: boolean }

declare module 'fastify' {
  interface FastifyRequest { admin: Admin }
}

const sealKey = (): Buffer => Buffer.from(env.MASTER_KEY, 'hex')
export const totpOk = (secret: string, code: string): boolean => verifySync({ secret, token: code, epochTolerance: 30 }).valid
const publicAdmin = (a: Admin) => ({ id: a.id, email: a.email, name: a.name, role: a.role, totpEnabled: a.totpEnabled })

export async function audit(admin: Admin | null, action: string, target = ''): Promise<void> {
  await sql`insert into audit_log (admin_id, admin_email, action, target) values (${admin?.id ?? null}, ${admin?.email ?? 'system'}, ${action}, ${target})`
}

/** Creates the first owner from env when no admin exists yet. */
export async function ensureBootstrapAdmin(): Promise<void> {
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) return
  const [n] = await sql<{ n: number }[]>`select count(*)::int as n from admins`
  if (n?.n) return
  await sql`insert into admins (id, email, name, password_hash, role) values (${base32(12)}, ${env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase()}, 'Owner', ${await hash(env.ADMIN_BOOTSTRAP_PASSWORD, ARGON)}, 'owner')`
}

export function adminAuth(app: FastifyInstance): void {
  let dummy = ''
  void hash(randomToken(), ARGON).then(h => { dummy = h })
  const bump = async (key: string): Promise<number> => {
    const n = await app.redis.incr(key)
    if (n === 1) await app.redis.expire(key, LOCK_TTL)
    return n
  }
  const cookieOpts = (path: string, httpOnly: boolean) => ({ httpOnly, secure: isProd, sameSite: 'strict' as const, path, maxAge: SESSION_MS / 1000 })

  async function startSession(req: FastifyRequest, reply: FastifyReply, adminId: string): Promise<void> {
    const token = randomToken(32), csrf = randomToken(16)
    await sql`insert into admin_sessions (token_hash, admin_id, csrf, expires_at, ip_hash, ua) values (${sha256(token)}, ${adminId}, ${csrf}, ${new Date(Date.now() + SESSION_MS)}, ${hashIp(req.ip) ?? 'unknown'}, ${(req.headers['user-agent'] ?? '').slice(0, 200)})`
    reply.setCookie('sid_adm', token, cookieOpts('/api/admin', true))
    reply.setCookie('csrf_adm', csrf, cookieOpts('/', false))
  }

  const lockCheck = async (email: string, ip: string): Promise<void> => {
    const [a, b] = await Promise.all([app.redis.get(K.admLock(email)), app.redis.get(K.admLockIp(ip))])
    if (Number(a) >= LOCK_MAX || Number(b) >= LOCK_MAX) throw new AppError(ERR.ACCOUNT_LOCKED, 'Too many attempts. Try again in 15 minutes.', 429)
  }
  const fail = async (email: string, ip: string): Promise<never> => {
    await Promise.all([bump(K.admLock(email)), bump(K.admLockIp(ip))])
    throw new AppError(ERR.UNAUTHORIZED, 'Invalid credentials', 401)
  }

  // ---- hook for every /api/admin route except login and totp ----
  const open_paths = new Set(['/api/admin/auth/login', '/api/admin/auth/totp'])
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/admin') || open_paths.has(req.url.split('?')[0] ?? '')) return
    const token = req.cookies.sid_adm
    if (!token) throw new AppError(ERR.UNAUTHORIZED, 'Sign in required', 401)
    const [s] = await sql<{ expires_at: Date; csrf: string; id: string; email: string; name: string; role: 'owner' | 'admin'; totp_enabled: boolean }[]>`
      select s.expires_at, s.csrf, a.id, a.email, a.name, a.role, a.totp_enabled from admin_sessions s join admins a on a.id = s.admin_id where s.token_hash = ${sha256(token)}`
    if (!s || s.expires_at.getTime() < Date.now()) throw new AppError(ERR.UNAUTHORIZED, 'Session expired', 401)
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-csrf'] !== s.csrf) throw new AppError(ERR.CSRF, 'Missing or invalid CSRF token', 403)
    if (s.expires_at.getTime() - Date.now() < EXTEND_BELOW_MS) {
      await sql`update admin_sessions set expires_at = ${new Date(Date.now() + SESSION_MS)} where token_hash = ${sha256(token)}`
      reply.setCookie('sid_adm', token, cookieOpts('/api/admin', true))
      reply.setCookie('csrf_adm', s.csrf, cookieOpts('/', false))
    }
    req.admin = { id: s.id, email: s.email, name: s.name, role: s.role, totpEnabled: s.totp_enabled }
  })

  app.post('/api/admin/auth/login', { config: { rateLimit: { max: 30, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { email, password } = adminLoginSchema.parse(req.body)
    const em = email.toLowerCase(), ip = hashIp(req.ip) ?? 'unknown'
    await lockCheck(em, ip)
    const [a] = await sql<{ id: string; password_hash: string; totp_enabled: boolean }[]>`select id, password_hash, totp_enabled from admins where email = ${em}`
    const ok = await verify(a?.password_hash ?? dummy, password).catch(() => false)
    if (!a || !ok) return fail(em, ip)
    await app.redis.del(K.admLock(em))
    if (a.totp_enabled) {
      const pendingToken = randomToken(24)
      await app.redis.set(K.admPending(sha256(pendingToken)), a.id, 'EX', 300)
      return { totpRequired: true, pendingToken }
    }
    await startSession(req, reply, a.id)
    return { ok: true }
  })

  app.post('/api/admin/auth/totp', async (req, reply) => {
    const { pendingToken, code } = adminTotpSchema.parse(req.body)
    const ip = hashIp(req.ip) ?? 'unknown'
    const key = K.admPending(sha256(pendingToken))
    const id = await app.redis.get(key)
    if (!id) throw new AppError(ERR.UNAUTHORIZED, 'Sign-in expired, start again', 401)
    await lockCheck(id, ip)
    const [a] = await sql<{ totp_secret_sealed: string | null }[]>`select totp_secret_sealed from admins where id = ${id}`
    if (!a?.totp_secret_sealed || !totpOk(open(sealKey(), a.totp_secret_sealed), code)) return fail(id, ip)
    await app.redis.del(key, K.admLock(id))
    await startSession(req, reply, id)
    return { ok: true }
  })

  app.get('/api/admin/auth/me', async req => publicAdmin(req.admin))

  const dropCookies = (reply: FastifyReply): void => { reply.clearCookie('sid_adm', { path: '/api/admin' }); reply.clearCookie('csrf_adm', { path: '/' }) }
  app.post('/api/admin/auth/logout', async (req, reply) => {
    await sql`delete from admin_sessions where token_hash = ${sha256(req.cookies.sid_adm ?? '')}`
    dropCookies(reply)
    return { ok: true }
  })
  app.post('/api/admin/auth/logout-all', async (req, reply) => {
    await sql`delete from admin_sessions where admin_id = ${req.admin.id}`
    dropCookies(reply)
    return { ok: true }
  })

  app.post('/api/admin/auth/password', async req => {
    const b = z.object({ old: z.string().min(1), next: passwordSchema }).parse(req.body)
    const [a] = await sql<{ password_hash: string }[]>`select password_hash from admins where id = ${req.admin.id}`
    if (!a || !await verify(a.password_hash, b.old).catch(() => false)) throw new AppError(ERR.UNAUTHORIZED, 'Current password is wrong', 401)
    await sql`update admins set password_hash = ${await hash(b.next, ARGON)} where id = ${req.admin.id}`
    await sql`delete from admin_sessions where admin_id = ${req.admin.id} and token_hash <> ${sha256(req.cookies.sid_adm ?? '')}`
    await audit(req.admin, 'password.change')
    return { ok: true }
  })

  app.post('/api/admin/auth/totp/setup', async req => {
    const secret = generateSecret()
    await sql`update admins set totp_secret_sealed = ${seal(sealKey(), secret)}, totp_enabled = false where id = ${req.admin.id}`
    const url = generateURI({ issuer: env.APP_NAME, label: req.admin.email, secret })
    return { secret, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) }
  })
  app.post('/api/admin/auth/totp/enable', async req => {
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body)
    const [a] = await sql<{ totp_secret_sealed: string | null }[]>`select totp_secret_sealed from admins where id = ${req.admin.id}`
    if (!a?.totp_secret_sealed || !totpOk(open(sealKey(), a.totp_secret_sealed), code)) throw new AppError(ERR.BAD_REQUEST, 'That code is not valid', 400)
    await sql`update admins set totp_enabled = true where id = ${req.admin.id}`
    await audit(req.admin, 'totp.enable')
    return { ok: true }
  })
  app.post('/api/admin/auth/totp/disable', async req => {
    await sql`update admins set totp_enabled = false, totp_secret_sealed = null where id = ${req.admin.id}`
    await audit(req.admin, 'totp.disable')
    return { ok: true }
  })

  // ---- admins (owner only) ----
  const owner = (req: FastifyRequest): void => { if (req.admin.role !== 'owner') throw new AppError(ERR.FORBIDDEN, 'Owner only', 403) }
  app.get('/api/admin/admins', async req => {
    owner(req)
    return (await sql<{ id: string; email: string; name: string; role: string; totp_enabled: boolean; created_at: Date }[]>`select id, email, name, role, totp_enabled, created_at from admins order by created_at`)
      .map(a => ({ id: a.id, email: a.email, name: a.name, role: a.role, totpEnabled: a.totp_enabled, createdAt: a.created_at.getTime() }))
  })
  app.post('/api/admin/admins', async req => {
    owner(req)
    const b = adminCreateSchema.parse(req.body)
    const r = await sql`insert into admins (id, email, name, password_hash, role) values (${base32(12)}, ${b.email.toLowerCase()}, ${b.name}, ${await hash(b.password, ARGON)}, ${b.role}) on conflict (email) do nothing returning id`
    if (!r.length) throw new AppError(ERR.CONFLICT, 'That email already has an account', 409)
    await audit(req.admin, 'admin.create', b.email)
    return { ok: true }
  })
  app.delete<{ Params: { id: string } }>('/api/admin/admins/:id', async req => {
    owner(req)
    const [t] = await sql<{ role: string; email: string }[]>`select role, email from admins where id = ${req.params.id}`
    if (!t) throw new AppError(ERR.NOT_FOUND, 'Admin not found', 404)
    if (t.role === 'owner') {
      const [n] = await sql<{ n: number }[]>`select count(*)::int as n from admins where role = 'owner'`
      if ((n?.n ?? 0) <= 1) throw new AppError(ERR.CONFLICT, 'Cannot remove the last owner', 409)
    }
    await sql`delete from admins where id = ${req.params.id}`
    await audit(req.admin, 'admin.delete', t.email)
    return { ok: true }
  })
  app.get<{ Querystring: { page?: string } }>('/api/admin/audit', async req => {
    const page = Math.max(1, Number(req.query.page) || 1)
    const rows = await sql<{ id: string; admin_email: string; action: string; target: string; created_at: Date }[]>`select id, admin_email, action, target, created_at from audit_log order by id desc limit 50 offset ${(page - 1) * 50}`
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from audit_log`
    return { items: rows.map(r => ({ id: r.id, admin: r.admin_email, action: r.action, target: r.target, at: r.created_at.getTime() })), total: n?.n ?? 0, page }
  })
}
