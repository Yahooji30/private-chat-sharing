import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { boot, client, connected, emitAck, once, sleep } from './helpers'
import type { Socket } from 'socket.io-client'

let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

const rnd = () => randomBytes(32).toString('base64')
const cl = (n: number) => client(`7.7.7.${n}`, `c${n}`.repeat(8))
const mk = async (code: string, authKey = rnd()) => {
  const r = await t.call(cl(1), 'POST', '/api/chat/rooms', { code, authKey, kdfSalt: randomBytes(16).toString('base64') })
  return { ...r, authKey }
}
const join = async (code: string, authKey: string, n: number): Promise<Socket> => {
  const tk = await t.call(cl(n), 'POST', `/api/chat/rooms/${code}/ticket`, { authKey })
  expect(tk.status).toBe(200)
  const s = t.sock(cl(n), '/chat', { ticket: tk.body.ticket })
  return connected(s)
}

describe('secure chat', () => {
  it('creates rooms, hides existence, locks out wrong passwords', async () => {
    const r = await mk('LOCKROOM')
    expect(r.status).toBe(200)
    expect((await mk('lockroom')).body.error.code).toBe('ROOM_EXISTS')
    const real = await t.call(cl(2), 'GET', '/api/chat/rooms/LOCKROOM/salt')
    const fake1 = await t.call(cl(2), 'GET', '/api/chat/rooms/NOPEROOM/salt')
    const fake2 = await t.call(cl(2), 'GET', '/api/chat/rooms/NOPEROOM/salt')
    expect(real.body.kdfSalt).toHaveLength(24)
    expect(fake1.body.kdfSalt).toBe(fake2.body.kdfSalt)
    for (let i = 0; i < 5; i++) expect((await t.call(cl(3), 'POST', '/api/chat/rooms/LOCKROOM/ticket', { authKey: rnd() })).body.error.code).toBe('ROOM_BAD_AUTH')
    expect((await t.call(cl(3), 'POST', '/api/chat/rooms/LOCKROOM/ticket', { authKey: r.authKey })).body.error.code).toBe('ROOM_LOCKED')
  })

  it('relays ciphertext, gives joiners no history, caps at 4, and wipes when empty', async () => {
    const { authKey } = await mk('FLOWROOM')
    const a = t.sock(cl(10), '/chat', { ticket: (await t.call(cl(10), 'POST', '/api/chat/rooms/FLOWROOM/ticket', { authKey })).body.ticket })
    const first = once(a, 'chat:members')
    await connected(a)
    expect(await first).toMatchObject({ slot: 0, count: 1 })
    const b = await join('FLOWROOM', authKey, 11)
    const got = once(b, 'chat:msg')
    const ack = await emitAck(a, 'chat:msg', { iv: 'aXZpdml2aXZpdml2', ct: 'Y2lwaGVydGV4dA==' })
    expect(ack.id).toMatch(/^\d+-\d+$/)
    expect(await got).toMatchObject({ ct: 'Y2lwaGVydGV4dA==', slot: 0 })
    expect(await t.api.redis.xlen('chat:FLOWROOM:msgs')).toBe(1)
    const c = t.sock(cl(12), '/chat', { ticket: (await t.call(cl(12), 'POST', '/api/chat/rooms/FLOWROOM/ticket', { authKey })).body.ticket })
    const seen: unknown[] = []
    c.on('chat:msg', m => seen.push(m))
    await connected(c)
    const d = await join('FLOWROOM', authKey, 13)
    const tk = await t.call(cl(14), 'POST', '/api/chat/rooms/FLOWROOM/ticket', { authKey })
    await expect(connected(t.sock(cl(14), '/chat', { ticket: tk.body.ticket }))).rejects.toThrow('full')
    await sleep(200)
    expect(seen).toHaveLength(0)
    expect((await emitAck(a, 'chat:msg', { iv: 'x', ct: '!!bad!!' })).error).toBe('REJECTED')
    for (const s of [a, b, c]) s.emit('chat:leave')
    await sleep(300)
    expect(await t.api.redis.exists('chat:FLOWROOM:slots')).toBe(1)
    d.emit('chat:leave')
    await sleep(300)
    expect(await t.api.redis.exists('chat:FLOWROOM:slots', 'chat:FLOWROOM:msgs', 'chat:FLOWROOM:meta')).toBe(0)
  })

  it('tickets are single use; a dropped tab resumes and replays only missed messages', async () => {
    const { authKey } = await mk('RESUMEROOM')
    const tk = await t.call(cl(20), 'POST', '/api/chat/rooms/RESUMEROOM/ticket', { authKey })
    const a = await connected(t.sock(cl(20), '/chat', { ticket: tk.body.ticket }))
    await expect(connected(t.sock(cl(20), '/chat', { ticket: tk.body.ticket }))).rejects.toThrow()
    const tk2 = await t.call(cl(21), 'POST', '/api/chat/rooms/RESUMEROOM/ticket', { authKey })
    const b = t.sock(cl(21), '/chat', { ticket: tk2.body.ticket })
    const init = once<any>(b, 'chat:members')
    await connected(b)
    const me = await init
    expect(me.resumeToken).toBeTruthy()
    const m1 = await emitAck(a, 'chat:msg', { iv: 'aXZpdml2aXZpdml2', ct: 'b25l' })
    await sleep(100)
    b.disconnect()
    await sleep(100)
    const m2 = await emitAck(a, 'chat:msg', { iv: 'aXZpdml2aXZpdml2', ct: 'dHdv' })
    const r = t.sock(cl(21), '/chat', { resume: { code: 'RESUMEROOM', token: me.resumeToken, lastId: m1.id } })
    const replayed = once<any>(r, 'chat:msg')
    await connected(r)
    const msg = await replayed
    expect(msg).toMatchObject({ id: m2.id, ct: 'dHdv', slot: 0 })
    await expect(connected(t.sock(cl(22), '/chat', { resume: { code: 'RESUMEROOM', token: 'x'.repeat(30), lastId: '0' } }))).rejects.toThrow()
    r.emit('chat:leave'); a.emit('chat:leave')
  })

  it('frees abandoned slots after the grace period and wipes the empty room', async () => {
    const { authKey } = await mk('GRACEROOM')
    const a = await join('GRACEROOM', authKey, 40)
    const b = await join('GRACEROOM', authKey, 41)
    a.disconnect(); b.disconnect()
    await sleep(1400)
    await t.rt.sweepChat()
    expect(await t.api.redis.exists('chat:GRACEROOM:slots', 'chat:GRACEROOM:meta')).toBe(0)
  })

  it('manage: wrong token forbidden, repassword kills old password, delete removes room', async () => {
    const r = await mk('MANAGEROOM')
    const path = '/api/chat/rooms/MANAGEROOM/manage'
    expect((await t.call(cl(30), 'POST', path, { action: 'delete', manageToken: 'x'.repeat(24) })).status).toBe(403)
    const newKey = rnd()
    expect((await t.call(cl(30), 'POST', path, { action: 'repassword', manageToken: r.body.manageToken, authKey: newKey, kdfSalt: randomBytes(16).toString('base64') })).status).toBe(200)
    expect((await t.call(cl(31), 'POST', '/api/chat/rooms/MANAGEROOM/ticket', { authKey: r.authKey })).status).toBe(401)
    expect((await t.call(cl(32), 'POST', '/api/chat/rooms/MANAGEROOM/ticket', { authKey: newKey })).status).toBe(200)
    expect((await t.call(cl(30), 'POST', path, { action: 'delete', manageToken: r.body.manageToken })).status).toBe(200)
    expect((await t.call(cl(33), 'POST', '/api/chat/rooms/MANAGEROOM/ticket', { authKey: newKey })).status).toBe(401)
  })
})
