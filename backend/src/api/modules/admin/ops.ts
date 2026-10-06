import type { FastifyInstance } from 'fastify'
import { ERR, SITE_KEYS, siteSettingsSchema } from '@sync/shared'
import { sql } from '../../../core/db/client'
import { AppError } from '../../../core/lib/errors'
import { renderMarkdown } from '../../../core/lib/markdown'
import { revalidate } from '../../../core/lib/revalidate'
import { K } from '../../../core/redis/keys'
import { audit } from './auth'

let roomsCache = { at: 0, n: 0 }

async function countRooms(app: FastifyInstance): Promise<number> {
  if (Date.now() - roomsCache.at < 10_000) return roomsCache.n
  let n = 0, cursor = '0'
  do {
    const [next, keys] = await app.redis.scan(cursor, 'MATCH', 'chat:*:slots', 'COUNT', 500)
    n += keys.length; cursor = next
  } while (cursor !== '0')
  roomsCache = { at: Date.now(), n }
  return n
}

async function rtCounts(app: FastifyInstance): Promise<{ devices: number; chatSockets: number }> {
  let devices = 0, chatSockets = 0, cursor = '0'
  do {
    const [next, keys] = await app.redis.scan(cursor, 'MATCH', 'rt:stats:*', 'COUNT', 100)
    cursor = next
    for (const k of keys) { const h = await app.redis.hgetall(k); devices += Number(h.space ?? 0); chatSockets += Number(h.chat ?? 0) }
  } while (cursor !== '0')
  return { devices, chatSockets }
}

export function opsRoutes(app: FastifyInstance): void {
  app.get('/api/admin/stats', async () => {
    const [rt, rooms] = await Promise.all([rtCounts(app), countRooms(app)])
    const one = async (q: Promise<{ n: number }[]>): Promise<number> => (await q)[0]?.n ?? 0
    const byStatus = await sql<{ status: string; n: number }[]>`select status, count(*)::int as n from articles group by status`
    return {
      onlineDevices: rt.devices, liveChatSockets: rt.chatSockets, activeChatRooms: rooms,
      activeSpaces24h: await one(sql`select count(*)::int as n from spaces where last_active_at > now() - interval '24 hours'`),
      chatRoomsTotal: await one(sql`select count(*)::int as n from chat_rooms`),
      publicPages: await one(sql`select count(*)::int as n from public_pages where status = 'published'`),
      openReports: await one(sql`select count(*)::int as n from page_reports where resolved_at is null`),
      articles: Object.fromEntries(byStatus.map(r => [r.status, r.n])),
    }
  })

  // ---- reports ----
  app.get('/api/admin/reports', async () => (await sql<{ id: string; page_id: string; slug: string; title: string; status: string; reason: string; created_at: Date; resolved_at: Date | null }[]>`
    select r.id, r.page_id, p.slug, p.title, p.status, r.reason, r.created_at, r.resolved_at from page_reports r join public_pages p on p.id = r.page_id
    order by (r.resolved_at is null) desc, r.created_at desc limit 200`).map(r => ({ id: Number(r.id), slug: r.slug, title: r.title, pageStatus: r.status, reason: r.reason, at: r.created_at.getTime(), resolved: !!r.resolved_at })))
  app.post<{ Params: { id: string } }>('/api/admin/reports/:id/resolve', async req => {
    const r = await sql`update page_reports set resolved_at = now() where id = ${req.params.id} and resolved_at is null returning id`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Report not found', 404)
    await audit(req.admin, 'report.resolve', req.params.id)
    return { ok: true }
  })
  app.post<{ Params: { slug: string } }>('/api/admin/public-pages/:slug/unpublish', async req => {
    const r = await sql`update public_pages set status = 'unpublished', updated_at = now() where slug = ${req.params.slug} returning id`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Page not found', 404)
    await sql`update page_reports set resolved_at = now() where page_id = (select id from public_pages where slug = ${req.params.slug}) and resolved_at is null`
    await audit(req.admin, 'page.unpublish', req.params.slug)
    await revalidate()
    return { ok: true }
  })
  app.delete<{ Params: { slug: string } }>('/api/admin/public-pages/:slug', async req => {
    const r = await sql`delete from public_pages where slug = ${req.params.slug} returning id`
    if (!r.length) throw new AppError(ERR.NOT_FOUND, 'Page not found', 404)
    await audit(req.admin, 'page.delete', req.params.slug)
    await revalidate()
    return { ok: true }
  })

  // ---- site settings ----
  app.get('/api/admin/site-settings', async () => Object.fromEntries((await sql<{ key: string; value: string }[]>`select key, value from site_settings`).map(r => [r.key, r.value])))
  app.put('/api/admin/site-settings', async req => {
    const b = siteSettingsSchema.parse(req.body)
    for (const [k, v] of Object.entries(b)) {
      if (!(SITE_KEYS as readonly string[]).includes(k)) continue
      await sql`insert into site_settings (key, value) values (${k}, ${v}) on conflict (key) do update set value = excluded.value`
      if (k === 'privacy_md' || k === 'terms_md') await sql`insert into site_settings (key, value) values (${k.replace('_md', '_html')}, ${renderMarkdown(v)}) on conflict (key) do update set value = excluded.value`
    }
    await audit(req.admin, 'site.update', Object.keys(b).join(','))
    await revalidate()
    return { ok: true }
  })
}
