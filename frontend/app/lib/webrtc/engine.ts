import { blockCount, blockLen, bmCount, bmFull, bmGet, bmNew, bmSet, CHUNK, fromB64, PER_PEER, rootOf, same, sha256, STALL_MS, toB64, TOTAL_INFLIGHT, type Header } from './protocol'

export interface EntryInfo { fileId: string; size: number; blockSize: number; rootHash: string | null }
export interface FileState { rootHash: string; bitmap: string; updatedAt: number }

export interface Storage {
  open(fileId: string, size: number): Promise<void>
  read(fileId: string, offset: number, len: number): Promise<Uint8Array | null>
  write(fileId: string, offset: number, data: Uint8Array): Promise<void>
  close(fileId: string): Promise<void>
  loadState(fileId: string): Promise<FileState | null>
  saveState(fileId: string, s: FileState): Promise<void>
  loadHashes(fileId: string): Promise<Uint8Array | null>
  saveHashes(fileId: string, h: Uint8Array): Promise<void>
  remove(fileId: string): Promise<void>
}

export interface Transport {
  send(peer: string, h: Header, payload?: Uint8Array): void
  buffered(peer: string): number
  drain(peer: string): Promise<void>
  peers(): string[]
}

export interface Progress { fileId: string; done: number; total: number; speed: number; sources: number; state: DlState }
export type DlState = 'running' | 'paused' | 'complete' | 'error'
export interface Events { progress(p: Progress): void; complete(fileId: string): void; holder(fileId: string): void; failed(fileId: string, reason: string): void }

interface Local { entry: EntryInfo; bits: Uint8Array; blob?: Blob; hashes: Uint8Array | null; full: boolean; open: boolean }
interface Inflight { peer: string; at: number; parts: Uint8Array[]; got: number; want: number }
interface Dl {
  entry: EntryInfo; state: DlState; inflight: Map<number, Inflight>; bad: Map<string, number>; samples: [number, number][]
  askedHashes: Set<string>; lastSave: number; verifying: Set<number>
}

const key = (f: string, p: string): string => `${f}|${p}`

export class Engine {
  private local = new Map<string, Local>()
  private dls = new Map<string, Dl>()
  private remote = new Map<string, Uint8Array | 'full'>()
  private serveQ = new Map<string, Promise<void>>()
  private tick: ReturnType<typeof setInterval> | undefined

  constructor(private st: Storage, private net: Transport, private ev: Events, private opts: { stallMs?: number } = {}) {
    this.tick = setInterval(() => this.watchdog(), 2000)
  }

  dispose(): void { clearInterval(this.tick) }

  /** Register a file this device can serve completely (sender after hashing, or restored complete file). */
  async addComplete(entry: EntryInfo, hashes: Uint8Array, blob?: Blob): Promise<void> {
    const n = blockCount(entry.size, entry.blockSize)
    this.local.set(entry.fileId, { entry, bits: bmFull(n), hashes, blob, full: true, open: false })
    await this.st.saveHashes(entry.fileId, hashes)
    this.announce(entry.fileId)
  }

  /** Restore partial progress from storage (reload / restart). Returns progress or null if nothing stored. */
  async restore(entry: EntryInfo): Promise<Progress | null> {
    if (!entry.rootHash) return null
    const s = await this.st.loadState(entry.fileId)
    if (!s || s.rootHash !== entry.rootHash) return null
    const n = blockCount(entry.size, entry.blockSize)
    const bits = Uint8Array.from(fromB64(s.bitmap))
    const hashes = await this.st.loadHashes(entry.fileId)
    const full = bmCount(bits, n) === n
    this.local.set(entry.fileId, { entry, bits, hashes, full, open: false })
    if (!full) {
      await this.st.open(entry.fileId, entry.size)
      this.local.get(entry.fileId)!.open = true
    }
    this.dls.set(entry.fileId, this.newDl(entry, full ? 'complete' : 'paused'))
    if (full) this.announce(entry.fileId)
    return this.progress(entry.fileId)
  }

  async start(entry: EntryInfo): Promise<void> {
    if (!entry.rootHash) return
    let l = this.local.get(entry.fileId)
    const existing = this.dls.get(entry.fileId)
    if (existing?.state === 'complete') return
    if (!l) {
      const n = blockCount(entry.size, entry.blockSize)
      await this.st.open(entry.fileId, entry.size)
      l = { entry, bits: bmNew(n), hashes: null, full: false, open: true }
      this.local.set(entry.fileId, l)
    } else if (!l.open && !l.full) { await this.st.open(entry.fileId, entry.size); l.open = true }
    const d = existing ?? this.newDl(entry, 'running')
    d.state = 'running'
    d.bad.clear()
    d.askedHashes.clear()
    this.dls.set(entry.fileId, d)
    this.emit(entry.fileId)
    this.pump(entry.fileId)
  }

  pause(fileId: string): void {
    const d = this.dls.get(fileId)
    if (!d || d.state !== 'running') return
    d.state = 'paused'
    d.inflight.clear()
    void this.persist(fileId, true)
    this.emit(fileId)
  }

  async cancel(fileId: string): Promise<void> {
    this.dls.delete(fileId)
    const l = this.local.get(fileId)
    this.local.delete(fileId)
    if (l?.open) await this.st.close(fileId)
    await this.st.remove(fileId)
  }

  isLocal(fileId: string): boolean { return this.local.get(fileId)?.full === true }
  progress(fileId: string): Progress | null {
    const l = this.local.get(fileId), d = this.dls.get(fileId)
    if (!l) return null
    const n = blockCount(l.entry.size, l.entry.blockSize)
    let done = 0
    for (let i = 0; i < n; i++) if (bmGet(l.bits, i)) done += blockLen(l.entry.size, l.entry.blockSize, i)
    return { fileId, done, total: l.entry.size, speed: d ? this.speed(d) : 0, sources: d ? this.sources(fileId).length : 0, state: l.full ? 'complete' : (d?.state ?? 'paused') }
  }

  // ---- network events ----
  onPeerOpen(peer: string): void { for (const id of this.local.keys()) this.sendHave(id, peer) }

  onPeerClose(peer: string): void {
    for (const k of [...this.remote.keys()]) if (k.endsWith(`|${peer}`)) this.remote.delete(k)
    for (const [id, d] of this.dls) {
      for (const [b, f] of d.inflight) if (f.peer === peer) d.inflight.delete(b)
      d.askedHashes.delete(peer)
      this.emit(id)
      this.pump(id)
    }
  }

  onFrame(peer: string, h: Header, payload: Uint8Array): void {
    const f = h.f
    if (!f) return
    switch (h.t) {
      case 'have': {
        this.remote.set(key(f, peer), h.full ? 'full' : fromB64(String(h.bm ?? '')))
        this.pump(f)
        break
      }
      case 'hashes?': {
        const l = this.local.get(f)
        if (l?.hashes) this.net.send(peer, { t: 'hashes', f }, l.hashes)
        else this.net.send(peer, { t: 'nohashes', f })
        break
      }
      case 'hashes': void this.gotHashes(f, peer, payload); break
      case 'nohashes': this.dls.get(f)?.askedHashes.add(peer); break
      case 'get': this.enqueueServe(peer, f, Number(h.b)); break
      case 'chunk': void this.gotChunk(peer, f, Number(h.b), Number(h.i), Number(h.n), payload); break
      case 'nope': this.gotNope(peer, f, Number(h.b)); break
    }
  }

  // ---- serving ----
  private enqueueServe(peer: string, f: string, b: number): void {
    const prev = this.serveQ.get(peer) ?? Promise.resolve()
    this.serveQ.set(peer, prev.then(() => this.serve(peer, f, b)).catch(() => undefined))
  }

  private async serve(peer: string, f: string, b: number): Promise<void> {
    const l = this.local.get(f)
    if (!l || !bmGet(l.bits, b)) return this.net.send(peer, { t: 'nope', f, b })
    const { size, blockSize } = l.entry
    const len = blockLen(size, blockSize, b)
    const data = l.blob ? new Uint8Array(await l.blob.slice(b * blockSize, b * blockSize + len).arrayBuffer()) : await this.st.read(f, b * blockSize, len)
    if (!data) return this.net.send(peer, { t: 'nope', f, b })
    const n = Math.ceil(len / CHUNK)
    for (let i = 0; i < n; i++) {
      if (this.net.buffered(peer) > 8 * 1024 * 1024) await this.net.drain(peer)
      this.net.send(peer, { t: 'chunk', f, b, i, n }, data.subarray(i * CHUNK, Math.min(len, (i + 1) * CHUNK)))
    }
  }

  // ---- downloading ----
  private newDl(entry: EntryInfo, state: DlState): Dl {
    return { entry, state, inflight: new Map(), bad: new Map(), samples: [], askedHashes: new Set(), lastSave: 0, verifying: new Set() }
  }

  private sources(f: string): string[] {
    return this.net.peers().filter(p => this.remote.has(key(f, p)) && (this.dls.get(f)?.bad.get(p) ?? 0) < 3)
  }

  private has(f: string, p: string, b: number): boolean {
    const r = this.remote.get(key(f, p))
    return r === 'full' || (r !== undefined && bmGet(r, b))
  }

  private pump(f: string): void {
    const d = this.dls.get(f), l = this.local.get(f)
    if (!d || !l || d.state !== 'running') return
    const srcs = this.sources(f)
    if (!l.hashes) {
      const p = srcs.find(s => !d.askedHashes.has(s))
      if (p) { d.askedHashes.add(p); this.net.send(p, { t: 'hashes?', f }) }
      else if (!srcs.length) this.emit(f)
      return
    }
    const n = blockCount(l.entry.size, l.entry.blockSize)
    let total = d.inflight.size
    const per = new Map<string, number>()
    for (const x of d.inflight.values()) per.set(x.peer, (per.get(x.peer) ?? 0) + 1)
    const missing: { b: number; rarity: number }[] = []
    for (let b = 0; b < n; b++) {
      if (bmGet(l.bits, b) || d.inflight.has(b) || d.verifying.has(b)) continue
      const rarity = srcs.filter(p => this.has(f, p, b)).length
      if (rarity > 0) missing.push({ b, rarity })
    }
    missing.sort((x, y) => x.rarity - y.rarity || x.b - y.b)
    for (const m of missing) {
      if (total >= TOTAL_INFLIGHT) break
      const peer = srcs.filter(p => this.has(f, p, m.b) && (per.get(p) ?? 0) < PER_PEER).sort((x, y) => (per.get(x) ?? 0) - (per.get(y) ?? 0))[0]
      if (!peer) continue
      d.inflight.set(m.b, { peer, at: Date.now(), parts: [], got: 0, want: blockLen(l.entry.size, l.entry.blockSize, m.b) })
      per.set(peer, (per.get(peer) ?? 0) + 1)
      total++
      this.net.send(peer, { t: 'get', f, b: m.b })
    }
    if (!d.inflight.size && !missing.length && !srcs.length) this.emit(f)
  }

  private async gotHashes(f: string, peer: string, hashes: Uint8Array): Promise<void> {
    const l = this.local.get(f)
    if (!l || l.hashes || !l.entry.rootHash) return
    if (hashes.length !== 32 * blockCount(l.entry.size, l.entry.blockSize) || await rootOf(hashes) !== l.entry.rootHash) {
      const d = this.dls.get(f)
      if (d) d.bad.set(peer, (d.bad.get(peer) ?? 0) + 1)
      return this.pump(f)
    }
    l.hashes = hashes
    await this.st.saveHashes(f, hashes)
    this.pump(f)
  }

  private gotNope(peer: string, f: string, b: number): void {
    const d = this.dls.get(f)
    if (d?.inflight.get(b)?.peer === peer) d.inflight.delete(b)
    const r = this.remote.get(key(f, peer))
    if (r && r !== 'full') r[b >> 3] = (r[b >> 3] ?? 0) & ~(1 << (b & 7))
    else this.remote.delete(key(f, peer))
    this.pump(f)
  }

  private async gotChunk(peer: string, f: string, b: number, i: number, n: number, data: Uint8Array): Promise<void> {
    const d = this.dls.get(f), l = this.local.get(f)
    const fl = d?.inflight.get(b)
    if (!d || !l || !fl || fl.peer !== peer || d.state !== 'running') return
    fl.parts[i] = new Uint8Array(data)
    fl.got += data.length
    fl.at = Date.now()
    d.samples.push([Date.now(), data.length])
    if (fl.parts.filter(Boolean).length < n) return
    d.inflight.delete(b)
    d.verifying.add(b)
    const buf = new Uint8Array(fl.got)
    let off = 0
    for (const p of fl.parts) { buf.set(p, off); off += p.length }
    try {
      const want = l.hashes?.subarray(b * 32, b * 32 + 32)
      if (buf.length !== fl.want || !want || !same(await sha256(buf), want)) {
        d.bad.set(peer, (d.bad.get(peer) ?? 0) + 1)
        queueMicrotask(() => this.pump(f))
        return
      }
      await this.st.write(f, b * l.entry.blockSize, buf)
      bmSet(l.bits, b)
      void this.persist(f, false)
    } finally {
      d.verifying.delete(b)
    }
    const total = blockCount(l.entry.size, l.entry.blockSize)
    if (bmCount(l.bits, total) === total) await this.finish(f)
    else { this.emit(f); this.pump(f) }
    if (!this.dls.has(f)) return
    if (this.sources(f).length === 0 && d.state === 'running' && !l.full) this.emit(f)
  }

  private async finish(f: string): Promise<void> {
    const d = this.dls.get(f), l = this.local.get(f)
    if (!d || !l) return
    l.full = true
    d.state = 'complete'
    await this.persist(f, true)
    await this.st.close(f)
    l.open = false
    this.emit(f)
    this.ev.complete(f)
    this.ev.holder(f)
    this.announce(f)
  }

  private async persist(f: string, force: boolean): Promise<void> {
    const d = this.dls.get(f), l = this.local.get(f)
    if (!d || !l?.entry.rootHash) return
    if (!force && Date.now() - d.lastSave < 500) return
    d.lastSave = Date.now()
    await this.st.saveState(f, { rootHash: l.entry.rootHash, bitmap: toB64(l.bits), updatedAt: Date.now() })
  }

  private watchdog(): void {
    const ms = this.opts.stallMs ?? STALL_MS
    for (const [f, d] of this.dls) {
      if (d.state !== 'running') continue
      let changed = false
      for (const [b, x] of d.inflight) {
        if (Date.now() - x.at > ms) { d.inflight.delete(b); d.bad.set(x.peer, (d.bad.get(x.peer) ?? 0) + 1); changed = true }
      }
      if (changed || d.inflight.size === 0) this.pump(f)
      this.emit(f)
    }
  }

  private speed(d: Dl): number {
    const cut = Date.now() - 3000
    d.samples = d.samples.filter(s => s[0] >= cut)
    return d.samples.reduce((a, s) => a + s[1], 0) / 3
  }

  private emit(f: string): void { const p = this.progress(f); if (p) this.ev.progress(p) }

  // ---- announcements ----
  private announce(f: string): void { for (const p of this.net.peers()) this.sendHave(f, p) }

  private sendHave(f: string, peer: string): void {
    const l = this.local.get(f)
    if (!l) return
    if (l.full) this.net.send(peer, { t: 'have', f, full: true })
    else if (bmCount(l.bits, blockCount(l.entry.size, l.entry.blockSize)) > 0) this.net.send(peer, { t: 'have', f, full: false, bm: toB64(l.bits) })
  }

  /** Re-announce bitmap (partial holders) to all peers; called by the UI layer on a timer. */
  announcePartial(): void { for (const [f, l] of this.local) if (!l.full) this.announce(f) }
  resumeAll(): void { for (const [f, d] of this.dls) if (d.state === 'running') this.pump(f) }
}
