import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { apply, type Op } from '@sync/shared'
import { boot, client, connected, emitAck, once, sleep } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

const V2 = { v: 2 }
// every test uses its own network, so each one starts with an empty text
let net = 0
const device = (suffix: string) => client(`77.7.${net}.1`, `ot${net}${suffix}`.padEnd(16, '0'))
const fresh = (): void => { net++ }
/** `legacy` = an older copy of the app, which does not say it understands edits */
const open = async (suffix: string, legacy = false) => connected(t.sock(device(suffix), '/space', legacy ? undefined : V2))
const text = async (suffix = 'a') => (await t.call(device(suffix), 'GET', '/api/text')).body as { content: string; rev: number }
const opsKeys = async (): Promise<string[]> => t.api.redis.keys('sp:*:hist')

describe('text edits', () => {
  it('applies an edit, answers with its revision and tells the other device', async () => {
    fresh()
    const a = await open('a'), b = await open('b')
    const got = once<{ rev: number; op: Op }>(b, 'text:op')
    const ack = await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['hello'] })
    expect(ack).toEqual({ rev: 1, opId: 'a.1' })
    expect(await got).toEqual({ rev: 1, op: ['hello'] })
    expect(await text()).toEqual({ content: 'hello', rev: 1 })
    a.close(); b.close()
  })

  it('two devices edit the same text at the same moment and both keep everything', async () => {
    fresh()
    const a = await open('a'), b = await open('b')
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['hello'] })
    await once(b, 'text:op')
    const seenByA = once<{ rev: number; op: Op }>(a, 'text:op'), seenByB = once<{ rev: number; op: Op }>(b, 'text:op')
    // neither has seen the other's edit yet
    const [ackA, ackB] = await Promise.all([
      emitAck(a, 'text:op', { opId: 'a.2', baseRev: 1, op: [5, ' world'] }),
      emitAck(b, 'text:op', { opId: 'b.1', baseRev: 1, op: ['>> '] }),
    ])
    expect([ackA.rev, ackB.rev].sort()).toEqual([2, 3])
    const fromB = await seenByA, fromA = await seenByB // each device is told of the other's edit, already fitted to the text
    const final = await text()
    expect(final.content).toBe('>> hello world')
    expect(final.rev).toBe(3)
    expect([fromA.rev, fromB.rev].sort()).toEqual([2, 3])
    a.close(); b.close()
  })

  it('every edit a device is told about, applied in order, rebuilds the server text exactly', async () => {
    fresh()
    const a = await open('a'), b = await open('b')
    let mirror = ''
    b.on('text:op', (m: { op: Op }) => { mirror = apply(mirror, m.op) })
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['one two three'] })
    await emitAck(a, 'text:op', { opId: 'a.2', baseRev: 1, op: [4, -3, 'TWO'] })
    await emitAck(a, 'text:op', { opId: 'a.3', baseRev: 2, op: [3, 'X'] })
    await sleep(150)
    expect(mirror).toBe((await text()).content)
    a.close(); b.close()
  })

  it('a repeated edit (the answer got lost) is not applied twice', async () => {
    fresh()
    const a = await open('a')
    const first = await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['abc'] })
    const again = await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['abc'] })
    expect(first).toEqual({ rev: 1, opId: 'a.1' })
    expect(again).toEqual({ rev: 1, opId: 'a.1' })
    expect(await text()).toEqual({ content: 'abc', rev: 1 })
    a.close()
  })

  it('an edit made on an old revision is fitted past what happened since', async () => {
    fresh()
    const a = await open('a'), b = await open('b')
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['hello world'] })
    await emitAck(a, 'text:op', { opId: 'a.2', baseRev: 1, op: ['START '] })
    await emitAck(b, 'text:op', { opId: 'b.1', baseRev: 1, op: [5, '!'] }) // made when the text was still "hello world"
    expect((await text()).content).toBe('START hello! world')
    a.close(); b.close()
  })
})

describe('catching up', () => {
  it('lists what a device missed, with its own edit marked by its id', async () => {
    fresh()
    const a = await open('a')
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['abc'] })
    await emitAck(a, 'text:op', { opId: 'a.2', baseRev: 1, op: [3, 'd'] })
    const r = await emitAck(a, 'text:sync', { sinceRev: 0 })
    expect(r).toEqual({ rev: 2, ops: [{ rev: 1, op: ['abc'], opId: 'a.1' }, { rev: 2, op: [3, 'd'], opId: 'a.2' }] })
    expect(await emitAck(a, 'text:sync', { sinceRev: 2 })).toEqual({ rev: 2, ops: [] })
    a.close()
  })

  it('hands over the whole text when the history no longer reaches back, and refuses the edit it never heard about', async () => {
    fresh()
    const a = await open('a'), b = await open('b')
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['abc'] })
    await emitAck(a, 'text:op', { opId: 'a.2', baseRev: 1, op: [3, 'd'] })
    for (const k of await opsKeys()) await t.api.redis.del(k) // the server forgot its history
    const sync = await emitAck(b, 'text:sync', { sinceRev: 0, opId: 'b.1' })
    expect(sync).toEqual({ content: 'abcd', rev: 2, applied: false })
    // a copy of that edit that was still on its way must not change anything now
    const late = await emitAck(b, 'text:op', { opId: 'b.1', baseRev: 0, op: ['!!'] })
    expect(late.stale).toMatchObject({ content: 'abcd', rev: 2 })
    expect(await text()).toEqual({ content: 'abcd', rev: 2 })
    // and a forced full sync always gives the text
    expect(await emitAck(b, 'text:sync', { sinceRev: -1 })).toMatchObject({ content: 'abcd', rev: 2 })
    a.close(); b.close()
  })

  it('an edit that already went through is reported as applied, not refused', async () => {
    fresh()
    const a = await open('a')
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['abc'] })
    for (const k of await opsKeys()) await t.api.redis.del(k)
    expect(await emitAck(a, 'text:sync', { sinceRev: -1, opId: 'a.1' })).toMatchObject({ content: 'abc', applied: true })
    a.close()
  })
})

describe('older copies of the app', () => {
  it('still get the whole text from a current device, and their writes reach current devices as edits', async () => {
    fresh()
    const current = await open('a'), old = await open('b', true)
    const wholeText = once<{ content: string; rev: number }>(old, 'text:changed')
    await emitAck(current, 'text:op', { opId: 'a.1', baseRev: 0, op: ['hello'] })
    expect(await wholeText).toMatchObject({ content: 'hello', rev: 1 })

    const edit = once<{ rev: number; op: Op }>(current, 'text:op')
    const ack = await emitAck(old, 'text:update', { content: 'hello there', baseRev: 1 })
    expect(ack.rev).toBe(2)
    const m = await edit
    expect(apply('hello', m.op)).toBe('hello there') // the replacement arrives as a small edit
    expect(await text()).toEqual({ content: 'hello there', rev: 2 })
    current.close(); old.close()
  })

  it('a current device can keep editing on top of a legacy write', async () => {
    fresh()
    const current = await open('a'), old = await open('b', true)
    await emitAck(old, 'text:update', { content: 'legacy', baseRev: 0 })
    await emitAck(current, 'text:op', { opId: 'a.1', baseRev: 1, op: [6, ' text'] })
    expect((await text()).content).toBe('legacy text')
    current.close(); old.close()
  })
})

describe('hostile or broken input', () => {
  it('rejects malformed edits', async () => {
    fresh()
    const a = await open('a')
    for (const bad of [
      { opId: 'x', baseRev: 0, op: [0] }, { opId: 'x', baseRev: 0, op: [1.5] }, { opId: 'x', baseRev: 0, op: [''] }, { opId: 'x', baseRev: 0, op: [null] },
      { opId: 'x', baseRev: 0, op: 'abc' }, { opId: '', baseRev: 0, op: [] }, { opId: 'x', baseRev: -1, op: [] }, { opId: 'x'.repeat(41), baseRev: 0, op: [] }, { nope: 1 },
      { opId: 'x', baseRev: 0, op: new Array(4001).fill(1) }, { opId: 'x', baseRev: 0, op: ['x'.repeat(100_001)] },
    ]) expect((await emitAck(a, 'text:op', bad)).error, JSON.stringify(bad).slice(0, 50)).toBe('BAD_REQUEST')
    expect((await emitAck(a, 'text:sync', { sinceRev: -2 })).error).toBe('BAD_REQUEST')
    expect(await text()).toEqual({ content: '', rev: 0 })
    a.close()
  })

  it('an edit that does not fit the text is refused and changes nothing', async () => {
    fresh()
    const a = await open('a')
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['abc'] })
    expect((await emitAck(a, 'text:op', { opId: 'a.2', baseRev: 1, op: [50, 'x'] })).error).toBe('BAD_REQUEST')
    expect((await emitAck(a, 'text:op', { opId: 'a.3', baseRev: 1, op: [-50] })).error).toBe('BAD_REQUEST')
    expect(await text()).toEqual({ content: 'abc', rev: 1 })
    a.close()
  })

  it('an edit that would make the text too long is turned away', async () => {
    fresh()
    const a = await open('a')
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['x'.repeat(60_000)] })
    const r = await emitAck(a, 'text:op', { opId: 'a.2', baseRev: 1, op: [60_000, 'y'.repeat(60_000)] })
    expect(r.stale).toBeTruthy()
    expect((await text()).content.length).toBe(60_000)
    a.close()
  })

  it('an edit from another network never reaches this one', async () => {
    fresh()
    const a = await open('a')
    const other = await connected(t.sock(client('78.8.8.8', 'otherothero0000x'), '/space', V2))
    let leaked = false
    other.on('text:op', () => { leaked = true })
    await emitAck(a, 'text:op', { opId: 'a.1', baseRev: 0, op: ['secret'] })
    await sleep(200)
    expect(leaked).toBe(false)
    expect((await t.call(client('78.8.8.8', 'otherothero0000x'), 'GET', '/api/text')).body.content).toBe('')
    a.close(); other.close()
  })
})
