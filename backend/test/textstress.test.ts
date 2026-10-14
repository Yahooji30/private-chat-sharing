import type { Socket } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TextClient, type HistoryEntry, type Op } from '@sync/shared'
import { boot, client, connected, emitAck, sleep } from './helpers'

/**
 * The real app logic (TextClient) on several devices, talking to the real server over real sockets, typing at the same time at
 * the speed people type. Every edit adds or removes a uniquely named word, so a lost, doubled or mangled edit is visible.
 */
let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

const rng = (seed: number): (() => number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 } }

class Device {
  readonly c: TextClient
  sock!: Socket
  busy = false
  serial = 0
  resyncs = 0
  private gapTimer: ReturnType<typeof setTimeout> | undefined
  constructor(readonly id: number, private readonly net: string) { this.c = new TextClient(`d${id}`) }
  private get who() { return client(this.net, `stress${this.id}`.padEnd(16, '0')) }

  async start(): Promise<void> {
    this.sock = await connected(t.sock(this.who, '/space', { v: 2 }))
    this.sock.on('text:op', (m: { rev: number; op: Op }) => { this.c.receive({ rev: m.rev, op: m.op }); if (this.c.gap) this.watchGap(); void this.pump() })
    const r = await t.call(this.who, 'GET', '/api/text')
    this.c.load(r.body.content, r.body.rev)
  }
  private watchGap(): void {
    if (this.gapTimer) return
    this.gapTimer = setTimeout(() => { this.gapTimer = undefined; if (this.c.gap) void this.catchUp(false) }, 400)
  }
  async catchUp(force: boolean): Promise<void> {
    const r = await emitAck<{ ops?: HistoryEntry[]; content?: string; rev?: number; applied?: boolean }>(this.sock, 'text:sync', { sinceRev: force ? -1 : this.c.rev, opId: this.c.outgoing()?.opId })
    if (r.ops) this.c.catchUp(r.ops)
    else if (r.content !== undefined) { this.c.resync(r.content, r.rev!, !!r.applied, 100_000); this.resyncs++ }
    void this.pump()
  }
  async pump(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      for (let out = this.c.outgoing(); out; out = this.c.outgoing()) {
        const r = await emitAck<{ rev?: number; opId?: string; stale?: { content: string; rev: number; applied: boolean }; error?: string }>(this.sock, 'text:op', out)
        if (r.rev !== undefined) this.c.receive({ rev: r.rev, ack: true, opId: r.opId })
        else if (r.stale) { this.c.resync(r.stale.content, r.stale.rev, r.stale.applied, 100_000); this.resyncs++ }
        else if (r.error === 'BAD_REQUEST') { this.busy = false; await this.catchUp(true); return }
        else await sleep(100)
        if (this.c.gap) this.watchGap()
      }
    } finally { this.busy = false }
  }
}

interface Out { converged: boolean; missing: string[]; duplicated: string[]; resurrected: string[]; stray: string; resyncs: number }

async function run(seed: number, devices: number, edits: number, gapMs: [number, number]): Promise<Out> {
  const net = `71.${seed % 250}.${Math.floor(seed / 250) % 250}.1`
  const rand = rng(seed)
  const int = (a: number, b: number): number => a + Math.floor(rand() * (b - a + 1))
  const devs = Array.from({ length: devices }, (_, i) => new Device(i, net))
  await Promise.all(devs.map(d => d.start()))
  const inserted = new Set<string>(), deleted = new Set<string>()
  const word = /⟦d\d+\.\d+⟧ /g

  // first edit puts some text in place so there is something to type around
  devs[0]!.c.edit('start of the shared text ', 25); await devs[0]!.pump()
  await sleep(150)

  await Promise.all(devs.map(async d => {
    for (let n = 0; n < edits; n++) {
      await sleep(int(gapMs[0], gapMs[1])) // the time between two keystrokes
      const text = d.c.doc
      const present = [...text.matchAll(word)]
      if (present.length > 3 && rand() < 0.3) {
        const w = present[int(0, present.length - 1)]!
        deleted.add(w[0].trim())
        d.c.edit(text.slice(0, w.index) + text.slice(w.index! + w[0].length), w.index)
      } else {
        const bounds = [0, ...[...text.matchAll(/ /g)].map(m => m.index! + 1)]
        const p = bounds[int(0, bounds.length - 1)]!
        const token = `⟦d${d.id}.${++d.serial}⟧`
        inserted.add(token)
        d.c.edit(text.slice(0, p) + token + ' ' + text.slice(p), p + token.length + 1)
      }
      void d.pump()
    }
  }))

  // quiet: let everything settle
  for (let i = 0; i < 100; i++) {
    await sleep(100)
    const server = (await t.call(devs[0] ? client(net, 'stress0'.padEnd(16, '0')) : client(net, 'x'), 'GET', '/api/text')).body as { content: string; rev: number }
    if (devs.every(d => !d.c.unsent && !d.busy && d.c.doc === server.content)) break
    for (const d of devs) if (d.c.gap) void d.catchUp(false)
  }
  const server = (await t.call(client(net, 'stress0'.padEnd(16, '0')), 'GET', '/api/text')).body as { content: string; rev: number }
  const text = server.content
  const count = (s: string): number => text.split(s).length - 1
  const result: Out = {
    converged: devs.every(d => d.c.doc === text && !d.c.unsent),
    missing: [...inserted].filter(x => !deleted.has(x) && count(x) === 0),
    duplicated: [...inserted].filter(x => count(x) > 1),
    resurrected: [...deleted].filter(x => count(x) > 0),
    stray: text.replace(word, '').replace('start of the shared text ', '').trim(),
    resyncs: devs.reduce((n, d) => n + d.resyncs, 0),
  }
  for (const d of devs) d.sock.close()
  return result
}

const ok = { converged: true, missing: [], duplicated: [], resurrected: [], stray: '', resyncs: 0 }

describe('real devices, real server, typing at the same time', { timeout: 180_000 }, () => {
  it('2 devices typing at human speed: nothing lost, nothing mangled, never falls back to a lossy merge', async () => {
    for (let seed = 1; seed <= 4; seed++) expect(await run(seed, 2, 40, [15, 60]), `seed ${seed}`).toEqual(ok)
  })
  it('3 devices typing very fast, all at once', async () => {
    for (let seed = 20; seed <= 23; seed++) expect(await run(seed, 3, 50, [3, 25]), `seed ${seed}`).toEqual(ok)
  })
  it('5 devices hammering the same text', async () => {
    for (let seed = 40; seed <= 42; seed++) expect(await run(seed, 5, 40, [2, 20]), `seed ${seed}`).toEqual(ok)
  })
})
