import type { Redis } from 'ioredis'
import { LIMITS } from '@sync/shared'
import { sql } from './db/client'
import { open, seal, spaceKey } from './lib/crypto'
import { K } from './redis/keys'
import { evalLua, TEXT_UPDATE } from './redis/lua'

export async function getSpaceSalt(spaceId: string): Promise<Buffer> {
  const [r] = await sql<{ salt: Buffer }[]>`select salt from spaces where id = ${spaceId}`
  if (!r) throw new Error('space missing')
  return r.salt
}

export async function readText(redis: Redis, spaceId: string): Promise<{ content: string; rev: number }> {
  const hot = await redis.hgetall(K.text(spaceId))
  if (hot.r !== undefined) return { content: hot.c ?? '', rev: Number(hot.r) }
  const [row] = await sql<{ content_sealed: string; rev: number }[]>`select content_sealed, rev from space_text where space_id = ${spaceId}`
  if (!row) return { content: '', rev: 0 }
  const content = row.content_sealed ? open(spaceKey(await getSpaceSalt(spaceId)), row.content_sealed) : ''
  await redis.hset(K.text(spaceId), { c: content, r: row.rev })
  await redis.expire(K.text(spaceId), 3600)
  return { content, rev: row.rev }
}

export async function writeText(redis: Redis, spaceId: string, content: string): Promise<number> {
  if (content.length > LIMITS.textChars) throw new Error('too large')
  const cur = await readText(redis, spaceId)
  return Number(await evalLua(redis, TEXT_UPDATE, [K.text(spaceId), K.dirty], [content, cur.rev, spaceId]))
}

export async function flushDirty(redis: Redis, batch = 100): Promise<number> {
  const ids = await redis.spop(K.dirty, batch)
  let done = 0
  for (const id of ids) {
    try {
      const hot = await redis.hgetall(K.text(id))
      if (hot.r === undefined) continue
      const sealed = hot.c ? seal(spaceKey(await getSpaceSalt(id)), hot.c) : ''
      await sql`insert into space_text (space_id, content_sealed, rev) values (${id}, ${sealed}, ${Number(hot.r)})
        on conflict (space_id) do update set content_sealed = excluded.content_sealed, rev = excluded.rev, updated_at = now()`
      done++
    } catch {
      await redis.sadd(K.dirty, id)
    }
  }
  return done
}
