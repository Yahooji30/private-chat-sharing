import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { boot, client, connected, once, sleep } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

describe('remote cursors', () => {
  it('shows one device\'s cursor to the others on the network, never to itself, and ignores nonsense', async () => {
    const a = client('88.1.1.1', 'curaaaaaaaaaaaaa'), b = client('88.1.1.1', 'curbbbbbbbbbbbbb')
    const sa = await connected(t.sock(a, '/space', { v: 2 })), sb = await connected(t.sock(b, '/space', { v: 2 }))
    const mine: unknown[] = []
    sa.on('text:cursor', m => mine.push(m))
    const seen = once<{ deviceId: string; start: number; end: number }>(sb, 'text:cursor')
    sa.emit('text:cursor', { start: 3, end: 7 })
    const m = await seen
    expect([m.start, m.end]).toEqual([3, 7])
    expect(m.deviceId).toMatch(/^[0-9a-f]{64}$/)
    // "left the text box" is passed on, garbage is dropped
    const left = once<{ start: number }>(sb, 'text:cursor')
    sa.emit('text:cursor', { start: -1, end: 0 })
    expect((await left).start).toBe(-1)
    sa.emit('text:cursor', { start: 'x', end: {} })
    sa.emit('text:cursor', { start: 5, end: 1e12 })
    await sleep(300)
    expect(mine).toEqual([])
    sa.close(); sb.close()
  })
})
