import type { Redis } from 'ioredis'
import { sql } from '../core/db/client'
import { K } from '../core/redis/keys'

async function guarded(redis: Redis, name: string, ttl: number, fn: () => Promise<unknown>): Promise<void> {
  if (await redis.set(K.lock(name), '1', 'EX', ttl, 'NX')) await fn().catch(() => undefined)
}

export async function runHourly(): Promise<void> {
  await sql`delete from file_entries where expires_at < now()`
  await sql`delete from spaces where last_active_at < now() - interval '90 days'`
  await sql`delete from chat_rooms where last_active_at < now() - interval '365 days'`
}

export function startCleanup(redis: Redis): NodeJS.Timeout {
  const t = setInterval(() => void guarded(redis, 'hourly', 3500, runHourly), 3600_000)
  t.unref()
  return t
}
