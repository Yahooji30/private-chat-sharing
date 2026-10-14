import { describe, expect, it } from 'vitest'
import { diffOp, type Op } from '../src/ot'
import { TextClient, serverHandleOp, serverSince, type HistoryEntry } from '../src/textsync'

describe('one device', () => {
  it('sends one edit at a time, collects typing meanwhile, and sends it next', () => {
    const c = new TextClient('t')
    c.load('Hello', 1)
    c.edit('Hello there')
    const first = c.outgoing()!
    expect(first).toMatchObject({ baseRev: 1, op: [5, ' there'] })
    expect(c.outgoing()!.opId).toBe(first.opId) // not answered yet: the same edit again
    c.edit('Hello there, friend') // typed while waiting
    c.edit('Hello there, friends')
    expect(c.outgoing()!.opId).toBe(first.opId)
    c.receive({ rev: 2, ack: true })
    const second = c.outgoing()!
    expect(second.opId).not.toBe(first.opId)
    expect(second).toMatchObject({ baseRev: 2, op: [11, ', friends'] })
    c.receive({ rev: 3, ack: true })
    expect(c.unsent).toBe(false)
    expect(c.outgoing()).toBeNull()
  })

  it('shows another device\'s change in the right place around unsent typing', () => {
    const c = new TextClient('t')
    c.load('alpha beta gamma', 1)
    c.edit('alpha beta gamma delta') // sent, unanswered
    c.edit('alpha beta gamma delta!') // buffered
    const applied = c.receive({ rev: 2, op: ['START '] })
    expect(c.doc).toBe('START alpha beta gamma delta!')
    expect(applied).toHaveLength(1)
    c.receive({ rev: 3, ack: true })
    expect(c.outgoing()).toMatchObject({ baseRev: 3 })
  })

  it('waits for a missing revision, ignores repeats, and applies in order', () => {
    const c = new TextClient('t')
    c.load('', 0)
    expect(c.receive({ rev: 2, op: [1, 'B'] })).toEqual([]) // revision 1 has not arrived yet
    expect(c.gap).toBe(true)
    expect(c.doc).toBe('')
    c.receive({ rev: 1, op: ['A'] })
    expect(c.doc).toBe('AB')
    expect(c.gap).toBe(false)
    expect(c.receive({ rev: 2, op: [1, 'B'] })).toEqual([]) // a repeat
    expect(c.doc).toBe('AB')
  })

  it('catches up from the server\'s history, taking its own edit for the answer', () => {
    const c = new TextClient('t')
    c.load('abc', 1)
    c.edit('abcX')
    const mine = c.outgoing()!
    const history: HistoryEntry[] = [{ rev: 2, op: ['>>'], opId: 'other.1' }, { rev: 3, op: [5, 'X'], opId: mine.opId }, { rev: 4, op: [6, 'Y'], opId: '' }]
    c.catchUp(history)
    expect(c.doc).toBe('>>abcXY')
    expect(c.rev).toBe(4)
    expect(c.unsent).toBe(false)
  })

  it('when too far behind, takes the server text and keeps what it typed', () => {
    const c = new TextClient('t')
    c.load('one two three', 1)
    c.edit('one two three four')
    const moves = c.resync('ONE two three', 9, false, 1000)
    expect(c.doc).toBe('ONE two three four')
    expect(c.rev).toBe(9)
    expect(moves.length).toBeGreaterThan(0)
    expect(c.outgoing()).toMatchObject({ baseRev: 9 })
  })
})

describe('server decisions', () => {
  const cur = { content: 'hello', rev: 3 }
  const h = (rev: number, op: Op, opId = 'x'): HistoryEntry => ({ rev, op, opId })

  it('applies an up-to-date edit as it is', () => {
    expect(serverHandleOp(cur, [], { opId: 'a', baseRev: 3, op: [5, '!'] }, undefined, 100)).toEqual({ kind: 'ok', rev: 4, op: [5, '!'], content: 'hello!' })
  })
  it('fits an edit made on an older revision past what happened since', () => {
    const history = [h(3, ['>> '])] // "hello" is really ">> hello" before? rev 3 inserted ">> " so the text is as below
    const text = { content: '>> hello', rev: 3 }
    const r = serverHandleOp(text, history, { opId: 'a', baseRev: 2, op: [5, '!'] }, undefined, 100)
    expect(r).toEqual({ kind: 'ok', rev: 4, op: [8, '!'], content: '>> hello!' })
  })
  it('recognises a repeat and does not apply it twice', () => {
    expect(serverHandleOp(cur, [], { opId: 'a', baseRev: 2, op: [5, '!'] }, { opId: 'a', rev: 3 }, 100)).toEqual({ kind: 'dup', rev: 3 })
  })
  it('asks the device to resync when the history does not reach back, or the device is ahead', () => {
    expect(serverHandleOp(cur, [h(3, [])], { opId: 'a', baseRev: 0, op: [] }, undefined, 100)).toEqual({ kind: 'stale' })
    expect(serverHandleOp(cur, null, { opId: 'a', baseRev: 1, op: [] }, undefined, 100)).toEqual({ kind: 'stale' })
    expect(serverHandleOp(cur, [], { opId: 'a', baseRev: 9, op: [] }, undefined, 100)).toEqual({ kind: 'stale' })
  })
  it('refuses an edit that does not fit the text, or makes it too long', () => {
    expect(serverHandleOp(cur, [], { opId: 'a', baseRev: 3, op: [99, 'x'] }, undefined, 100)).toEqual({ kind: 'bad' })
    expect(serverHandleOp(cur, [], { opId: 'a', baseRev: 3, op: [5, 'xxxxxxxxxx'] }, undefined, 8)).toEqual({ kind: 'toolarge' })
  })
  it('lists what a device missed, or says the history is too short', () => {
    const hist = [h(2, []), h(3, [])]
    expect(serverSince(cur, hist, 3)).toEqual([])
    expect(serverSince(cur, hist, 1)).toEqual(hist)
    expect(serverSince(cur, hist, 0)).toBeNull()
    expect(serverSince(cur, hist, 7)).toBeNull()
  })
})

// ---- many devices, a bad network ----

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

interface Opts { devices: number; ticks: number; editRate: number; dropRequest: number; dropAnswer: number; offline: number; maxHistory: number }
interface Result { converged: boolean; missing: string[]; duplicated: string[]; resurrected: string[]; stray: string; resyncs: number }

/**
 * Devices type at the same moment over a network that delays and reorders messages, loses requests, loses answers and
 * drops off the network. The server and the devices run the real shared code. Every edit adds or removes a uniquely
 * named word, so any lost, doubled or mangled edit shows.
 */
function simulate(seed: number, o: Opts): Result {
  const rand = rng(seed)
  const int = (a: number, b: number): number => a + Math.floor(rand() * (b - a + 1))
  const queue: { at: number; n: number; fn: () => void }[] = []
  let n = 0
  let now = 0
  const at = (t: number, fn: () => void): void => { queue.push({ at: t, n: n++, fn }) }
  const run = (): void => {
    let guard = 0
    while (queue.length && guard++ < 400_000) {
      queue.sort((a, b) => a.at - b.at || a.n - b.n)
      const ev = queue.shift()!
      now = Math.max(now, ev.at)
      ev.fn()
    }
  }

  const server = { content: 'start of the shared text ', rev: 1, history: [] as HistoryEntry[], last: new Map<number, { opId: string; rev: number }>() }
  let resyncs = 0
  interface Dev { id: number; c: TextClient; busy: boolean; offline: boolean; serial: number }
  const devs: Dev[] = Array.from({ length: o.devices }, (_, id) => {
    const c = new TextClient(`d${id}`)
    c.load(server.content, server.rev)
    return { id, c, busy: false, offline: false, serial: 0 }
  })
  const inserted = new Set<string>()
  const deleted = new Set<string>()
  const word = /⟦d\d+\.\d+⟧ /g

  const sinceReply = (d: Dev, since: number, opId: string | undefined): { ops: HistoryEntry[] } | { content: string; rev: number; applied: boolean } => {
    const ops = serverSince({ content: server.content, rev: server.rev }, server.history, since)
    if (ops) return { ops }
    const mark = server.last.get(d.id)
    const applied = !!opId && mark?.opId === opId && mark.rev >= 0
    // the device is about to give up on this edit: make sure a copy still travelling can never be applied later
    if (opId && !applied) server.last.set(d.id, { opId, rev: -1 })
    return { content: server.content, rev: server.rev, applied }
  }

  // a device asks what it missed (after coming back, or when a revision is missing)
  const catchUp = (d: Dev): void => {
    if (d.offline) return
    const since = d.c.rev, opId = d.c.outgoing()?.opId
    at(now + int(1, 6), () => {
      const r = sinceReply(d, since, opId)
      at(now + int(1, 6), () => {
        if (d.offline) return
        if ('ops' in r) d.c.catchUp(r.ops)
        else { d.c.resync(r.content, r.rev, r.applied, 100_000); resyncs++ }
        pump(d)
      })
    })
  }

  const pump = (d: Dev): void => {
    if (d.busy || d.offline) return
    const out = d.c.outgoing()
    if (!out) return
    d.busy = true
    const done = (again: boolean): void => { d.busy = false; if (again) at(now + int(1, 3), () => pump(d)) }
    if (rand() < o.dropRequest) { at(now + 25, () => done(true)); return }
    at(now + int(1, 8), () => {
      const cur = { content: server.content, rev: server.rev }
      const res = serverHandleOp(cur, server.history, out, server.last.get(d.id), 100_000)
      let reply: { ack: number } | { stale: { content: string; rev: number; applied: boolean } }
      if (res.kind === 'ok') {
        server.content = res.content
        server.rev = res.rev
        server.history.push({ rev: res.rev, op: res.op, opId: out.opId })
        if (server.history.length > o.maxHistory) server.history.splice(0, server.history.length - o.maxHistory)
        server.last.set(d.id, { opId: out.opId, rev: res.rev })
        for (const x of devs) if (x !== d) at(now + int(1, 9), () => { if (!x.offline) { x.c.receive({ rev: res.rev, op: res.op }); if (x.c.gap) at(now + 30, () => { if (x.c.gap) catchUp(x) }); pump(x) } })
        reply = { ack: res.rev }
      } else if (res.kind === 'dup') reply = { ack: res.rev }
      else {
        reply = { stale: { content: server.content, rev: server.rev, applied: false } }
        server.last.set(d.id, { opId: out.opId, rev: -1 }) // refused for good: a late copy of it must not be applied
      }
      if (rand() < o.dropAnswer) { at(now + 25, () => done(true)); return }
      at(now + int(1, 8), () => {
        if ('ack' in reply) d.c.receive({ rev: reply.ack, ack: true, opId: out.opId })
        else { d.c.resync(reply.stale.content, reply.stale.rev, reply.stale.applied, 100_000); resyncs++ }
        if (d.c.gap) at(now + 30, () => { if (d.c.gap) catchUp(d) })
        done(true)
      })
    })
  }

  const edit = (d: Dev): void => {
    const t = d.c.doc
    const present = [...t.matchAll(word)]
    if (present.length > 3 && rand() < 0.3) {
      const w = present[int(0, present.length - 1)]!
      deleted.add(w[0].trim())
      d.c.edit(t.slice(0, w.index) + t.slice(w.index! + w[0].length), w.index)
    } else {
      const bounds = [0, ...[...t.matchAll(/ /g)].map(m => m.index! + 1)]
      const p = bounds[int(0, bounds.length - 1)]!
      const token = `⟦d${d.id}.${++d.serial}⟧`
      inserted.add(token)
      d.c.edit(t.slice(0, p) + token + ' ' + t.slice(p), p + token.length + 1) // the cursor ends up after what was typed
    }
    at(now + int(1, 3), () => pump(d))
  }

  for (let t = 0; t < o.ticks; t++) {
    for (const d of devs) {
      if (rand() < o.editRate) at(t, () => edit(d))
      if (rand() < o.offline) {
        at(t, () => { d.offline = true })
        at(t + int(5, 60), () => { d.offline = false; catchUp(d) })
      }
    }
  }
  run()
  // everything quiet: bring every device up to date and let it finish
  for (let k = 0; k < 30 && devs.some(d => d.c.unsent || d.c.doc !== server.content); k++) {
    for (const d of devs) { d.offline = false; d.busy = false; catchUp(d) }
    run()
  }

  const text = server.content
  const count = (s: string): number => text.split(s).length - 1
  const expected = [...inserted].filter(x => !deleted.has(x))
  return {
    converged: devs.every(d => d.c.doc === text && d.c.rev === server.rev && !d.c.unsent),
    missing: expected.filter(x => count(x) === 0),
    duplicated: [...inserted].filter(x => count(x) > 1),
    resurrected: [...deleted].filter(x => count(x) > 0),
    stray: text.replace(word, '').replace('start of the shared text ', '').trim(),
    resyncs,
  }
}

// each test runs dozens of simulated sessions: give them room on a slow or busy machine
describe('many devices typing at once', { timeout: 60_000 }, () => {
  const clean = (r: Result): Omit<Result, 'resyncs'> => ({ converged: r.converged, missing: r.missing, duplicated: r.duplicated, resurrected: r.resurrected, stray: r.stray })
  const ok = { converged: true, missing: [], duplicated: [], resurrected: [], stray: '' }
  const base: Opts = { devices: 3, ticks: 300, editRate: 0.2, dropRequest: 0, dropAnswer: 0, offline: 0, maxHistory: 100_000 }

  it('2 devices typing as fast as they can: nothing lost, everyone identical', () => {
    for (let seed = 1; seed <= 80; seed++) expect(clean(simulate(seed, { ...base, devices: 2, editRate: 0.3 })), `seed ${seed}`).toEqual(ok)
  })

  it('5 devices with delays and out-of-order messages', () => {
    for (let seed = 100; seed < 150; seed++) expect(clean(simulate(seed, { ...base, devices: 5 })), `seed ${seed}`).toEqual(ok)
  })

  it('lost requests and lost answers never lose or double an edit', () => {
    for (let seed = 200; seed < 260; seed++) expect(clean(simulate(seed, { ...base, devices: 4, dropRequest: 0.12, dropAnswer: 0.18 })), `seed ${seed}`).toEqual(ok)
  })

  it('devices dropping off the network and coming back lose nothing', () => {
    for (let seed = 300; seed < 360; seed++) expect(clean(simulate(seed, { ...base, devices: 4, dropRequest: 0.05, dropAnswer: 0.05, offline: 0.01 })), `seed ${seed}`).toEqual(ok)
  })

  it('when the server has forgotten too much history, every device still ends identical', () => {
    // The fallback lays a device's unsent typing on the new text by matching context, so which words survive is best effort
    // (it only happens when a device missed more edits than the server remembers). What must always hold: no crash, and
    // every device ends with the same text.
    let resynced = 0
    for (let seed = 400; seed < 440; seed++) {
      const r = simulate(seed, { ...base, devices: 4, dropRequest: 0.05, dropAnswer: 0.05, offline: 0.02, maxHistory: 4 })
      resynced += r.resyncs
      expect(r.converged, `seed ${seed}`).toBe(true)
    }
    expect(resynced).toBeGreaterThan(0) // the fallback really was exercised
  })

  it('with a history of a few dozen edits, a device that was offline for a while still loses nothing', () => {
    for (let seed = 600; seed < 640; seed++) expect(clean(simulate(seed, { ...base, devices: 3, ticks: 200, editRate: 0.1, dropRequest: 0.03, dropAnswer: 0.03, offline: 0.005, maxHistory: 60 })), `seed ${seed}`).toEqual(ok)
  })
})

describe('typing like a person', () => {
  it('the cursor stays with the text while another device types before it', () => {
    const c = new TextClient('t')
    c.load('Hello world', 1)
    let caret = 5 // after "Hello"
    for (const ch of ['A', 'B', 'C']) {
      for (const m of c.receive({ rev: c.rev + 1, op: [0, ch + ' '].filter(x => x !== 0) as Op })) caret = m.length ? caret + (typeof m[0] === 'string' ? m[0].length : 0) : caret
    }
    expect(c.doc.startsWith('C B A ')).toBe(true)
    expect(caret).toBe(5 + 6)
    expect(diffOp(c.doc, c.doc)).toEqual([])
  })
})
