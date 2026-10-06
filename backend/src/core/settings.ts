import { DEFAULT_SETTINGS, settingsSchema, type Settings } from '@sync/shared'
import { sql } from './db/client'

export async function getSettings(spaceId: string): Promise<Settings> {
  const [r] = await sql<{ json: unknown }[]>`select json from space_settings where space_id = ${spaceId}`
  const p = settingsSchema.safeParse(r?.json ?? {})
  return p.success ? p.data : DEFAULT_SETTINGS
}

export async function putSettings(spaceId: string, s: Settings): Promise<void> {
  await sql`insert into space_settings (space_id, json) values (${spaceId}, ${sql.json(s)})
    on conflict (space_id) do update set json = excluded.json`
}
