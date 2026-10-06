import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { boot, client, connected, emitAck, once, sleep } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

const A = client('8.8.8.8', 'aaaaaaaaaaaaaaaa')
const A2 = client('8.8.8.8', 'a2a2a2a2a2a2a2a2')
const B = client('9.9.9.9', 'bbbbbbbbbbbbbbbb')

describe('space + text', () => {
  it('resolves the same space for same IP and exposes device info', async () => {
    const me = await t.call(A, 'GET', '/api/space/me')
    expect(me.status).toBe(200)
    expect(me.body.device.name).toMatch(/^\w+ \w+$/)
    expect(me.body.ip).toBe('8.8.8.8')
  })

  it('syncs text between two devices on one network and persists it', async () => {
    const s1 = await connected(t.sock(A, '/space'))
    const s2 = await connected(t.sock(A2, '/space'))
    const changed = once(s2, 'text:changed')
    const ack = await emitAck(s1, 'text:update', { content: 'hello world', baseRev: 0 })
    expect(ack.rev).toBe(1)
    expect((await changed).content).toBe('hello world')
    expect((await t.call(A2, 'GET', '/api/text')).body).toMatchObject({ content: 'hello world', rev: 1 })
    await sleep(1500)
    const [row] = await (await import('../src/core/db/client')).sql`select content_sealed from space_text`
    expect(row?.content_sealed).not.toContain('hello')
    s1.close(); s2.close()
  })

  it('does not leak text to other networks and rejects oversize or invalid payloads', async () => {
    expect((await t.call(B, 'GET', '/api/text')).body.content).toBe('')
    const s = await connected(t.sock(A, '/space'))
    expect((await emitAck(s, 'text:update', { content: 'x'.repeat(100_001), baseRev: 0 })).error).toBe('BAD_REQUEST')
    expect((await emitAck(s, 'text:update', { nope: 1 })).error).toBe('BAD_REQUEST')
    s.close()
  })

  it('presence lists online devices and collapses tabs', async () => {
    const s1 = await connected(t.sock(A, '/space'))
    const s1b = await connected(t.sock(A, '/space'))
    const s2 = t.sock(A2, '/space')
    const list = once<any[]>(s2, 'presence:list')
    await connected(s2)
    const l = await list
    expect(l.length).toBeGreaterThanOrEqual(1)
    await sleep(500)
    const p = await new Promise<any[]>(r => { s1.once('presence:list', r); s2.disconnect(); })
    expect(p).toHaveLength(1)
    s1.close(); s1b.close()
  })

  it('renames device and updates settings with broadcast', async () => {
    expect((await t.call(A, 'PATCH', '/api/device', { name: 'My Laptop' })).body.name).toBe('My Laptop')
    expect((await t.call(A, 'GET', '/api/space/me')).body.device.name).toBe('My Laptop')
    const s = await connected(t.sock(A2, '/space'))
    const ev = once(s, 'settings:changed')
    const put = await t.call(A, 'PUT', '/api/settings', { fontSize: 20, fontFamily: 'mono', urlsPanel: false })
    expect(put.status).toBe(200)
    expect((await ev).fontSize).toBe(20)
    expect((await t.call(A, 'PUT', '/api/settings', { fontSize: 99 })).status).toBe(400)
    s.close()
  })
})

describe('files manifest', () => {
  it('adds, readies, holds and removes entries across devices', async () => {
    const s1 = await connected(t.sock(A, '/space'))
    const s2 = await connected(t.sock(A2, '/space'))
    const added = once<any[]>(s2, 'files:added')
    const meta = { fileId: 'file_abc12345', name: 'secret.txt', mime: 'text/plain', size: 10, blockSize: 1048576 }
    expect((await emitAck(s1, 'files:add', meta)).ok).toBe(true)
    expect((await added)[0].name).toBe('secret.txt')
    const ready = once(s2, 'files:ready')
    const rootHash = 'a'.repeat(64)
    expect((await emitAck(s2, 'files:ready', { fileId: meta.fileId, rootHash })).error).toBe('FORBIDDEN')
    expect((await emitAck(s1, 'files:ready', { fileId: meta.fileId, rootHash })).ok).toBe(true)
    expect((await ready).rootHash).toBe(rootHash)
    const holders = once(s1, 'files:holders')
    expect((await emitAck(s2, 'files:holder', { fileId: meta.fileId })).ok).toBe(true)
    expect((await holders).holders).toHaveLength(2)
    const list = (await t.call(A, 'GET', '/api/files')).body as any
    expect(list[0]).toMatchObject({ name: 'secret.txt', rootHash })
    expect((await t.call(B, 'GET', '/api/files')).body).toEqual([])
    const removed = once(s1, 'files:removed')
    await emitAck(s2, 'files:remove', { fileId: meta.fileId })
    await removed
    s1.close(); s2.close()
  })

  it('forwards rtc signals only inside the space', async () => {
    const s1 = await connected(t.sock(A, '/space'))
    const s2 = await connected(t.sock(A2, '/space'))
    const sB = await connected(t.sock(B, '/space'))
    const devB = (await t.call(B, 'GET', '/api/space/me')).body.device.id
    const devA2 = (await t.call(A2, 'GET', '/api/space/me')).body.device.id
    const sig = once(s2, 'rtc:signal')
    expect((await emitAck(s1, 'rtc:signal', { to: devA2, data: { sdp: 'x' } })).ok).toBe(true)
    expect((await sig).data).toEqual({ sdp: 'x' })
    expect((await emitAck(s1, 'rtc:signal', { to: devB, data: {} })).error).toBe('PEER_OFFLINE')
    s1.close(); s2.close(); sB.close()
  })
})
