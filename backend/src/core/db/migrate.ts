import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from './client'

/** Applies any new .sql files in order. An advisory lock makes it safe for several API processes to start at once. */
export async function migrate(): Promise<void> {
  const dir = join(import.meta.dirname, 'migrations')
  const conn = await sql.reserve()
  try {
    await conn`select pg_advisory_lock(727001)`
    await conn`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`
    for (const f of readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
      const [done] = await conn`select 1 from _migrations where name = ${f}`
      if (done) continue
      await conn.unsafe('begin')
      try {
        await conn.unsafe(readFileSync(join(dir, f), 'utf8'))
        await conn`insert into _migrations (name) values (${f})`
        await conn.unsafe('commit')
      } catch (e) { await conn.unsafe('rollback'); throw e }
    }
  } finally {
    await conn`select pg_advisory_unlock(727001)`.catch(() => undefined)
    conn.release()
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  await migrate()
  await sql.end()
  console.log('migrated')
}
