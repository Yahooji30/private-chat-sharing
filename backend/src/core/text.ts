import type { Redis } from 'ioredis'
import { diffOp, serverHandleOp, serverSince, type DocState, type HistoryEntry, type Op } from '@sync/shared'
import { env } from './config/env'
import { sql } from './db/client'
import { open, seal, spaceKey } from './lib/crypto'
import { K } from './redis/keys'
import { evalLua, TEXT_FENCE, TEXT_OP } from './redis/lua'

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

const HISTORY = 2000 // how many recent edits are remembered, for devices that are only a little behind

interface Snapshot { cur: DocState; history: HistoryEntry[] | null; last: { opId: string; rev: number } | undefined }

/**
 * One consistent look at the text, its recent history and this device's last edit, read in a single Redis transaction, so another
 * edit cannot slip in between and make a device look further behind than it is (which would send it down the lossy fallback).
 * The history is kept by revision, so the edits after `baseRev` are asked for by name: revision baseRev+1, baseRev+2, ...
 */
async function snapshot(redis: Redis, spaceId: string, deviceId: string, baseRev: number): Promise<Snapshot> {
  const from = Math.max(baseRev, 0)
  let want = 48 // edits to read along with the text: enough for a device that is a few edits behind
  for (let attempt = 0; attempt < 6; attempt++) {
    const fields = Array.from({ length: want }, (_, i) => String(from + 1 + i))
    const res = await redis.multi().hget(K.text(spaceId), 'r').hget(K.text(spaceId), 'c').get(K.textOp(spaceId, deviceId)).hmget(K.textHist(spaceId), ...fields).exec()
    const rev = res?.[0]?.[1] as string | null | undefined
    if (rev === null || rev === undefined) { await readText(redis, spaceId); continue } // not in Redis (idle for an hour): bring it back from the database
    const need = Number(rev) - from
    if (need > want && need <= HISTORY) { want = Math.min(HISTORY, need + 16); continue } // behind by more than we read: read more, together with the text again
    const lastRaw = String(res?.[2]?.[1] ?? '')
    const i = lastRaw.lastIndexOf(':')
    let history: HistoryEntry[] | null = null
    try { history = ((res?.[3]?.[1] as (string | null)[] | undefined) ?? []).filter((j): j is string => !!j).map(j => { const e = JSON.parse(j) as { r: number; o: Op; i: string }; return { rev: e.r, op: e.o, opId: e.i } }) } catch { history = null }
    return { cur: { content: String(res?.[1]?.[1] ?? ''), rev: Number(rev) }, history, last: i > 0 ? { opId: lastRaw.slice(0, i), rev: Number(lastRaw.slice(i + 1)) } : undefined }
  }
  return { cur: await readText(redis, spaceId), history: null, last: undefined }
}

/** Refuse this edit for good, so a copy of it that is still on its way can never be applied. Returns true if it had in fact already gone through. */
async function fence(redis: Redis, spaceId: string, deviceId: string, opId: string): Promise<boolean> {
  const v = String(await evalLua(redis, TEXT_FENCE, [K.textOp(spaceId, deviceId)], [opId, `${opId}:-1`]))
  return !v.endsWith(':-1')
}

export type ApplyResult =
  | { kind: 'ok'; rev: number; op: Op; content: string }
  | { kind: 'dup'; rev: number }
  | { kind: 'stale'; rev: number; content: string }
  | { kind: 'bad' }

/**
 * One device's edit, made on revision `baseRev`: fitted past everything that happened since, applied, and remembered. The write
 * only happens if nobody else wrote in between (if they did, it is fitted again). A repeat of an edit that already went through
 * is recognised by its opId and not applied twice. 'stale' = the server cannot fit it any more: the device must take the current text.
 */
export async function applyOp(redis: Redis, spaceId: string, deviceId: string, req: { opId: string; baseRev: number; op: Op }): Promise<ApplyResult> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const { cur, history, last } = await snapshot(redis, spaceId, deviceId, req.baseRev)
    const res = serverHandleOp(cur, history, req, last, env.TEXT_MAX_CHARS)
    if (res.kind === 'dup') return res
    if (res.kind === 'bad') return res
    if (res.kind === 'stale' || res.kind === 'toolarge') {
      if (await fence(redis, spaceId, deviceId, req.opId)) return { kind: 'dup', rev: (await snapshot(redis, spaceId, deviceId, req.baseRev)).last?.rev ?? cur.rev }
      return { kind: 'stale', rev: cur.rev, content: cur.content }
    }
    const entry = JSON.stringify({ r: res.rev, o: res.op, i: req.opId })
    const rev = Number(await evalLua(redis, TEXT_OP, [K.text(spaceId), K.dirty, K.textOp(spaceId, deviceId), K.textHist(spaceId)], [res.content, cur.rev, spaceId, `${req.opId}:${res.rev}`, entry]))
    if (rev > 0) return res
    // someone else wrote first: fit again against the new text
  }
  throw new Error('text is too busy')
}

/** For older copies of the app, which send the whole text: replace it (last one wins, as before), as an edit like any other. */
export async function replaceText(redis: Redis, spaceId: string, content: string): Promise<{ rev: number; op: Op; content: string; written: boolean }> {
  if (content.length > env.TEXT_MAX_CHARS) throw new Error('too large')
  for (let attempt = 0; attempt < 8; attempt++) {
    const cur = await readText(redis, spaceId)
    const op = diffOp(cur.content, content)
    if (!op.length) return { rev: cur.rev, op, content, written: false }
    const entry = JSON.stringify({ r: cur.rev + 1, o: op, i: '' })
    const rev = Number(await evalLua(redis, TEXT_OP, [K.text(spaceId), K.dirty, K.textOp(spaceId, '-'), K.textHist(spaceId)], [content, cur.rev, spaceId, '', entry]))
    if (rev > 0) return { rev, op, content, written: true }
  }
  throw new Error('text is too busy')
}

export type SyncResult = { ops: HistoryEntry[]; rev: number } | { content: string; rev: number; applied: boolean }

/**
 * A device asks for what it missed since `sinceRev` (after a reconnect, or when a message went missing). `opId` = the edit it never
 * got an answer for. If the history no longer reaches back, it gets the current text instead, and that edit is refused for good unless
 * it had already gone through (`applied`).
 */
export async function syncText(redis: Redis, spaceId: string, deviceId: string, sinceRev: number, opId: string | undefined): Promise<SyncResult> {
  const { cur, history } = await snapshot(redis, spaceId, deviceId, sinceRev)
  const ops = sinceRev >= 0 ? serverSince(cur, history, sinceRev) : null
  if (ops) return { ops, rev: cur.rev }
  const applied = opId ? await fence(redis, spaceId, deviceId, opId) : false
  return { content: cur.content, rev: cur.rev, applied }
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
