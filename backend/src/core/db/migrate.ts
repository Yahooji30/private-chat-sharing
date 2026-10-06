import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from './client'

export async function migrate(): Promise<void> {
  const dir = join(import.meta.dirname, 'migrations')
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`
  for (const f of readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
    const [done] = await sql`select 1 from _migrations where name = ${f}`
    if (done) continue
    await sql.begin(async tx => {
      await tx.unsafe(readFileSync(join(dir, f), 'utf8'))
      await tx`insert into _migrations (name) values (${f})`
    })
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  await migrate()
  await sql.end()
  console.log('migrated')
}
