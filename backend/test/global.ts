import { Redis } from 'ioredis'
import postgres from 'postgres'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export default async function setup(): Promise<void> {
  const sql = postgres('postgres://sync_app:sync_dev@127.0.0.1:5432/sync_test', { onnotice: () => {} })
  await sql.unsafe('drop schema public cascade; create schema public;')
  const dir = join(import.meta.dirname, '../src/core/db/migrations')
  for (const f of readdirSync(dir).sort()) await sql.unsafe(readFileSync(join(dir, f), 'utf8'))
  await sql.end()
  const r = new Redis('redis://127.0.0.1:6379/1')
  await r.flushdb()
  await r.quit()
}
