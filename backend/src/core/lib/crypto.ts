import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { CROCKFORD } from '@sync/shared'
import { env } from '../config/env'
import { normalizeIp } from './ip'

export const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex')
export const randomToken = (bytes = 24): string => randomBytes(bytes).toString('base64url')

export function hashIp(ip: string): string | null {
  const n = normalizeIp(ip)
  return n ? createHmac('sha256', env.IP_PEPPER).update(n).digest('hex') : null
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function base32(len: number): string {
  const bytes = randomBytes(len)
  let out = ''
  for (const b of bytes) out += CROCKFORD[b & 31]
  return out
}

const keyCache = new Map<string, Buffer>()
export function spaceKey(salt: Buffer): Buffer {
  const id = salt.toString('hex')
  let k = keyCache.get(id)
  if (!k) {
    k = Buffer.from(hkdfSync('sha256', Buffer.from(env.MASTER_KEY, 'hex'), salt, 'space-data', 32))
    if (keyCache.size > 10_000) keyCache.delete(keyCache.keys().next().value as string)
    keyCache.set(id, k)
  }
  return k
}

export function seal(key: Buffer, plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64')
}

export function open(key: Buffer, sealed: string): string {
  const buf = Buffer.from(sealed, 'base64')
  const d = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12))
  d.setAuthTag(buf.subarray(buf.length - 16))
  return Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]).toString('utf8')
}
