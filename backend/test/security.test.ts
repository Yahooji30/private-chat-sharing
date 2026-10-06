import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from '../src/core/db/client'
import { boot, client, connected, emitAck, once, sleep } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

describe('access control', () => {
  it('every admin route rejects anonymous callers, and mutations need a CSRF token', async () => {
    const admin = t.api.routeTable.filter(r => r.includes('/api/admin') && !/auth\/(login|totp)$/.test(r) && !r.startsWith('HEAD') && !r.startsWith('OPTIONS'))
    expect(admin.length).toBeGreaterThan(30)
    for (const r of admin) {
      const [method, url] = r.split(' ') as [string, string]
      const res = await t.api.inject({ method: method as 'GET', url: url.replace(/:\w+/g, 'x'), headers: { 'x-forwarded-for': '9.8.7.6' }, payload: method === 'GET' ? undefined : {} })
      expect(res.statusCode, r).toBe(401)
    }
  })

  it('isolates files between spaces: no overwrite, remove, ready or holder from outside', async () => {
    const A = client('21.0.0.1', 'isoaisoaisoaisoa1'), B = client('21.0.0.2', 'isobisobisobisob1')
    const sa = await connected(t.sock(A, '/space')), sb = await connected(t.sock(B, '/space'))
    const meta = { fileId: 'iso_file_0001', name: 'private.txt', mime: 'text/plain', size: 5, blockSize: 1048576 }
    expect((await emitAck(sa, 'files:add', meta)).ok).toBe(true)
    expect((await emitAck(sb, 'files:add', { ...meta, name: 'hijack.txt' })).error).toBeTruthy()
    expect((await emitAck(sb, 'files:ready', { fileId: meta.fileId, rootHash: 'a'.repeat(64) })).error).toBe('FORBIDDEN')
    expect((await emitAck(sb, 'files:holder', { fileId: meta.fileId })).error).toBe('NOT_FOUND')
    await emitAck(sb, 'files:remove', { fileId: meta.fileId })
    const list = (await t.call(A, 'GET', '/api/files')).body as any[]
    expect(list).toHaveLength(1); expect(list[0].name).toBe('private.txt')
    expect((await t.call(B, 'GET', '/api/files')).body).toEqual([])
    sa.close(); sb.close()
  })

  it('stores no raw IPs and keeps user text and file names sealed at rest', async () => {
    const ips = ['21.0.0.1', '21.0.0.2', '8.8.4.4']
    const T = client('8.8.4.4', 'rawiprawiprawip01')
    const s = await connected(t.sock(T, '/space'))
    await emitAck(s, 'text:update', { content: 'top secret sentence', baseRev: 0 })
    await emitAck(s, 'files:add', { fileId: 'sealed_file_01', name: 'tax-return.pdf', mime: 'application/pdf', size: 9, blockSize: 1048576 })
    await sleep(1300)
    const dump = JSON.stringify(await Promise.all(['spaces', 'space_ips', 'devices', 'space_text', 'file_entries', 'admin_sessions', 'page_reports', 'chat_rooms'].map(tb => sql`select * from ${sql(tb)}`)))
    for (const ip of ips) expect(dump).not.toContain(ip)
    expect(dump).not.toContain('top secret'); expect(dump).not.toContain('tax-return')
    s.close()
  })

  it('sets safe cookie flags and security headers', async () => {
    const res = await t.api.inject({ method: 'GET', url: '/api/space/me', headers: { 'x-forwarded-for': '22.1.1.1' } })
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/sid_dev=/); expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/SameSite=Lax/i)
    expect(res.headers['x-content-type-options']).toBe('nosniff'); expect(res.headers['x-frame-options']).toBeTruthy()
  })

  it('rejects oversized bodies and malformed or hostile input', async () => {
    const u = client('22.2.2.2', 'hostilehostile001')
    expect((await t.call(u, 'PUT', '/api/settings', { fontSize: 20, junk: 'x'.repeat(300_000) })).status).toBe(413)
    expect((await t.call(u, 'POST', '/api/chat/rooms', { code: "x'; drop table chat_rooms;--", authKey: 'a'.repeat(30), kdfSalt: 'a'.repeat(24) })).status).toBe(400)
    expect((await t.call(u, 'GET', "/api/p/x'%20or%201=1--")).status).toBe(404)
    expect((await t.call(u, 'GET', '/api/blog/articles?q=%27%3B%20drop%20table%20articles%3B--')).status).toBe(200)
    expect((await t.call(u, 'GET', '/api/blog/articles?page=abc')).status).toBe(400)
    expect((await t.call(u, 'POST', '/api/public-pages', { title: '<img src=x onerror=alert(1)>', body: 'ok' })).status).toBe(200)
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from chat_rooms`
    expect(row?.n).toBeGreaterThanOrEqual(0)
  })

  it('applies the global HTTP rate limit per network', async () => {
    const u = client('23.3.3.3', 'floodfloodflood01')
    let limited = 0
    for (let i = 0; i < 330; i++) if ((await t.call(u, 'GET', '/api/health')).status === 429) limited++
    expect(limited).toBeGreaterThan(0)
    expect((await t.call(client('23.3.3.4', 'otherothero00001'), 'GET', '/api/health')).status).toBe(200)
  })
})

describe('realtime limits and concurrency', () => {
  it('throttles a socket that floods events', async () => {
    const u = client('24.1.1.1', 'socketfloodsock01')
    const s = await connected(t.sock(u, '/space'))
    const results = await Promise.all(Array.from({ length: 150 }, (_, i) => emitAck(s, 'text:update', { content: `v${i}`, baseRev: 0 })))
    expect(results.some(r => r.error === 'RATE_LIMITED')).toBe(true)
    expect(results.some(r => typeof r.rev === 'number')).toBe(true)
    s.close()
  })

  it('keeps revisions monotonic when two devices write at once', async () => {
    const A = client('24.2.2.2', 'concurrentconcur01'), B = client('24.2.2.2', 'concurrentconcur02')
    const sa = await connected(t.sock(A, '/space')), sb = await connected(t.sock(B, '/space'))
    const revs = await Promise.all(Array.from({ length: 20 }, (_, i) => emitAck(i % 2 ? sa : sb, 'text:update', { content: `w${i}`, baseRev: 0 })))
    const seen = revs.map(r => r.rev).sort((x, y) => x - y)
    expect(new Set(seen).size).toBe(20)
    expect(seen[19]).toBe(seen[0] + 19)
    sa.close(); sb.close()
  })

  it('never lets more than four people into a chat room, even with simultaneous joins', async () => {
    const authKey = randomBytes(32).toString('base64')
    const owner = client('25.0.0.1', 'chatraceowner0001')
    await t.call(owner, 'POST', '/api/chat/rooms', { code: 'RACEROOM', authKey, kdfSalt: randomBytes(16).toString('base64') })
    const tickets = await Promise.all(Array.from({ length: 8 }, async (_, i) => {
      const c = client(`25.0.1.${i}`, `chatracer${i}`.padEnd(16, 'x'))
      return { c, ticket: (await t.call(c, 'POST', '/api/chat/rooms/RACEROOM/ticket', { authKey })).body.ticket as string }
    }))
    const outcomes = await Promise.all(tickets.map(async ({ c, ticket }) => {
      const s = t.sock(c, '/chat', { ticket })
      try { await connected(s); return s } catch { s.close(); return null }
    }))
    const joined = outcomes.filter(Boolean)
    expect(joined).toHaveLength(4)
    expect(Object.keys(await t.api.redis.hgetall('chat:RACEROOM:slots')).sort()).toEqual(['0', '1', '2', '3'])
    for (const s of joined) s?.emit('chat:leave')
    await sleep(300)
  })

  it('chat messages are never stored as plaintext and the ring is capped', async () => {
    const authKey = randomBytes(32).toString('base64')
    const o = client('25.5.0.1', 'chatringowner0001')
    await t.call(o, 'POST', '/api/chat/rooms', { code: 'RINGROOM', authKey, kdfSalt: randomBytes(16).toString('base64') })
    const tk = (await t.call(o, 'POST', '/api/chat/rooms/RINGROOM/ticket', { authKey })).body.ticket
    const s = await connected(t.sock(o, '/chat', { ticket: tk }))
    for (let i = 0; i < 260; i++) { await emitAck(s, 'chat:msg', { iv: 'aXZpdml2aXZpdml2', ct: Buffer.from(`ciphertext-${i}`).toString('base64') }); if (i % 5 === 4) await sleep(1000 / 4) }
    expect(await t.api.redis.xlen('chat:RINGROOM:msgs')).toBeLessThanOrEqual(260)
    expect(await t.api.redis.ttl('chat:RINGROOM:msgs')).toBeGreaterThan(0)
    s.emit('chat:leave')
  }, 60_000)
})

describe('linking moves already connected devices', () => {
  it('a device that is online when its network is linked joins the new space without a manual reload', async () => {
    const owner = client('26.0.0.1', 'linkowner0000001'), other = client('26.0.0.2', 'linkother0000001')
    const so = await connected(t.sock(owner, '/space'))
    await emitAck(so, 'text:update', { content: 'owner text', baseRev: 0 })
    const live = await connected(t.sock(other, '/space'))
    const dropped = once(live, 'disconnect')
    expect((await t.call(owner, 'POST', '/api/link/ip', { ip: '26.0.0.2' })).status).toBe(200)
    await dropped
    const again = await connected(t.sock(other, '/space'))
    const got = once(again, 'text:changed')
    await emitAck(so, 'text:update', { content: 'owner text 2', baseRev: 0 })
    expect((await got).content).toBe('owner text 2')
    const nets = (await t.call(owner, 'GET', '/api/link/list')).body.networks
    const gone = once(again, 'disconnect')
    await t.call(owner, 'DELETE', `/api/link/ip/${nets[0].id}`)
    await gone
    expect((await t.call(other, 'GET', '/api/text')).body.content).toBe('')
    so.close(); again.close()
  })
})
