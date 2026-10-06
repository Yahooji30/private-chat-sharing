import { LIMITS, type FileEntry, type FileMeta } from '@sync/shared'
import { sql } from './db/client'
import { open, seal, spaceKey } from './lib/crypto'
import { getSpaceSalt } from './text'

interface Row { id: string; meta_sealed: string; size: string; block_size: number; root_hash: string | null; added_by: string; added_at: Date; holders: string[] | null }

async function toEntry(key: Buffer, r: Row): Promise<FileEntry> {
  const m = JSON.parse(open(key, r.meta_sealed)) as { name: string; mime: string; thumb?: string }
  return { fileId: r.id, name: m.name, mime: m.mime, ...(m.thumb ? { thumb: m.thumb } : {}), size: Number(r.size), blockSize: r.block_size,
    rootHash: r.root_hash, addedBy: r.added_by, addedAt: r.added_at.getTime(), holders: r.holders ?? [] }
}

export async function listFiles(spaceId: string): Promise<FileEntry[]> {
  const key = spaceKey(await getSpaceSalt(spaceId))
  const rows = await sql<Row[]>`select e.id, e.meta_sealed, e.size, e.block_size, e.root_hash, e.added_by, e.added_at,
    (select array_agg(device_id) from file_holders h where h.file_id = e.id) as holders
    from file_entries e where e.space_id = ${spaceId} and e.expires_at > now() order by e.added_at`
  return Promise.all(rows.map(r => toEntry(key, r)))
}

export async function addFile(spaceId: string, deviceId: string, m: FileMeta): Promise<FileEntry | null> {
  const key = spaceKey(await getSpaceSalt(spaceId))
  const [{ n } = { n: 0 }] = await sql<{ n: number }[]>`select count(*)::int as n from file_entries where space_id = ${spaceId}`
  if (n >= LIMITS.maxFiles) return null
  const sealed = seal(key, JSON.stringify({ name: m.name, mime: m.mime, thumb: m.thumb }))
  const [row] = await sql<Row[]>`insert into file_entries (id, space_id, meta_sealed, size, block_size, added_by)
    values (${m.fileId}, ${spaceId}, ${sealed}, ${m.size}, ${m.blockSize}, ${deviceId})
    on conflict (id) do nothing returning id, meta_sealed, size, block_size, root_hash, added_by, added_at, null::text[] as holders`
  return row ? toEntry(key, row) : null
}

export async function markReady(spaceId: string, deviceId: string, fileId: string, rootHash: string): Promise<boolean> {
  const r = await sql`update file_entries set root_hash = ${rootHash} where id = ${fileId} and space_id = ${spaceId} and added_by = ${deviceId} and root_hash is null returning id`
  if (!r.length) return false
  await sql`insert into file_holders (file_id, device_id) values (${fileId}, ${deviceId}) on conflict do nothing`
  return true
}

export async function addHolder(spaceId: string, deviceId: string, fileId: string): Promise<string[] | null> {
  const [f] = await sql`select 1 from file_entries where id = ${fileId} and space_id = ${spaceId} and root_hash is not null`
  if (!f) return null
  await sql`insert into file_holders (file_id, device_id) values (${fileId}, ${deviceId}) on conflict do nothing`
  const rows = await sql<{ device_id: string }[]>`select device_id from file_holders where file_id = ${fileId}`
  return rows.map(r => r.device_id)
}

export async function removeFile(spaceId: string, fileId: string): Promise<boolean> {
  return (await sql`delete from file_entries where id = ${fileId} and space_id = ${spaceId} returning id`).length > 0
}
export const clearFiles = (spaceId: string) => sql`delete from file_entries where space_id = ${spaceId}`
