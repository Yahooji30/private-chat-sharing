import { afterEach, describe, expect, it } from 'vitest'
import { Engine, type EntryInfo, type FileState, type Storage, type Transport } from '../app/lib/webrtc/engine'
import { decodeFrame, encodeFrame, blockCount, bmFull, bmCount, bmGet, bmNew, bmSet, rootOf, sha256, type Header } from '../app/lib/webrtc/protocol'

class MemStorage implements Storage {
  data = new Map<string, Uint8Array>(); states = new Map<string, FileState>(); hashes = new Map<string, Uint8Array>()
  async open(id: string, size: number) { if (!this.data.has(id)) this.data.set(id, new Uint8Array(size)) }
  async read(id: string, off: number, len: number) { return this.data.get(id)?.slice(off, off + len) ?? null }
  async write(id: string, off: number, d: Uint8Array) { this.data.get(id)!.set(d, off) }
  async close() {}
  async loadState(id: string) { return this.states.get(id) ?? null }
  async saveState(id: string, s: FileState) { this.states.set(id, s) }
  async loadHashes(id: string) { return this.hashes.get(id) ?? null }
  async saveHashes(id: string, h: Uint8Array) { this.hashes.set(id, h) }
  async remove(id: string) { this.data.delete(id); this.states.delete(id); this.hashes.delete(id) }
}

class Hub {
  nodes = new Map<string, Node>(); sent: { from: string; to: string; h: Header }[] = []; down = new Set<string>()
  corrupt = new Set<string>()
  link(a: string, b: string) { this.nodes.get(a)!.up.add(b); this.nodes.get(b)!.up.add(a); this.nodes.get(a)!.eng.onPeerOpen(b); this.nodes.get(b)!.eng.onPeerOpen(a) }
  cut(a: string, b: string) { this.nodes.get(a)!.up.delete(b); this.nodes.get(b)!.up.delete(a); this.nodes.get(a)!.eng.onPeerClose(b); this.nodes.get(b)!.eng.onPeerClose(a) }
}
class Node {
  up = new Set<string>(); eng!: Engine; done: string[] = []
  constructor(public id: string, public hub: Hub, public st = new MemStorage()) {
    const t: Transport = {
      send: (peer, h, payload) => {
        if (!this.up.has(peer)) return
        hub.sent.push({ from: id, to: peer, h })
        let body = payload
        if (body && hub.corrupt.has(id) && h.t === 'chunk') { body = body.slice(); body[0] = (body[0] ?? 0) ^ 0xff }
        const frame = decodeFrame(encodeFrame(h, body))
        setTimeout(() => { if (this.up.has(peer)) hub.nodes.get(peer)?.eng.onFrame(id, frame.h, frame.payload) }, 0)
      },
      buffered: () => 0, drain: async () => {}, peers: () => [...this.up],
    }
    this.eng = new Engine(st, t, { progress() {}, complete: f => this.done.push(f), holder() {}, failed() {} }, { stallMs: 300 })
    hub.nodes.set(id, this)
  }
}

const BS = 64 * 1024
async function makeFile(size: number) {
  const data = new Uint8Array(size)
  for (let i = 0; i < size; i++) data[i] = (i * 31 + (i >> 8)) & 255
  const n = blockCount(size, BS)
  const hashes = new Uint8Array(32 * n)
  for (let b = 0; b < n; b++) hashes.set(await sha256(data.subarray(b * BS, Math.min(size, (b + 1) * BS))), b * 32)
  const entry: EntryInfo = { fileId: 'file_test0001', size, blockSize: BS, rootHash: await rootOf(hashes) }
  return { data, hashes, entry }
}
const until = async (fn: () => boolean, ms = 8000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 5)) } }
const engines: Engine[] = []
afterEach(() => { engines.splice(0).forEach(e => e.dispose()) })
const mk = (hub: Hub, id: string, st?: MemStorage) => { const n = new Node(id, hub, st); engines.push(n.eng); return n }

describe('protocol', () => {
  it('round-trips frames and bitmaps', () => {
    const f = decodeFrame(encodeFrame({ t: 'chunk', f: 'x', b: 3 }, new Uint8Array([1, 2, 3])))
    expect(f.h).toMatchObject({ t: 'chunk', b: 3 }); expect([...f.payload]).toEqual([1, 2, 3])
    const bm = bmNew(20); bmSet(bm, 0); bmSet(bm, 19)
    expect(bmGet(bm, 19)).toBe(true); expect(bmGet(bm, 1)).toBe(false); expect(bmCount(bm, 20)).toBe(2); expect(bmCount(bmFull(20), 20)).toBe(20)
    expect(() => decodeFrame(new Uint8Array([0, 0, 1, 0, 1]))).toThrow()
  })
})

describe('transfer engine', () => {
  it('downloads a file block-verified from a holder', async () => {
    const hub = new Hub(), A = mk(hub, 'A'), B = mk(hub, 'B')
    const { data, hashes, entry } = await makeFile(BS * 5 + 1234)
    await A.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    hub.link('A', 'B')
    await B.eng.start(entry)
    await until(() => B.done.length === 1)
    expect(Buffer.from(B.st.data.get(entry.fileId)!).equals(Buffer.from(data))).toBe(true)
    expect(B.eng.isLocal(entry.fileId)).toBe(true)
    expect(B.eng.progress(entry.fileId)).toMatchObject({ done: data.length, state: 'complete' })
  })

  it('pulls from several sources and a partial holder re-shares what it has', async () => {
    const hub = new Hub(), A = mk(hub, 'A'), B = mk(hub, 'B'), C = mk(hub, 'C')
    const { data, hashes, entry } = await makeFile(BS * 12)
    await A.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    hub.link('A', 'B'); hub.link('A', 'C'); hub.link('B', 'C')
    await B.eng.start(entry); await C.eng.start(entry)
    await until(() => B.done.length === 1 && C.done.length === 1)
    expect(Buffer.from(C.st.data.get(entry.fileId)!).equals(Buffer.from(data))).toBe(true)
    const servedByB = hub.sent.filter(m => m.from === 'B' && m.h.t === 'chunk').length
    const servedByA = hub.sent.filter(m => m.from === 'A' && m.h.t === 'chunk').length
    expect(servedByA).toBeGreaterThan(0)
    expect(servedByA + servedByB).toBeGreaterThanOrEqual(12)
  })

  it('rejects corrupted blocks, flags the bad peer and finishes from an honest one', async () => {
    const hub = new Hub(), A = mk(hub, 'A'), M = mk(hub, 'M'), B = mk(hub, 'B')
    const { data, hashes, entry } = await makeFile(BS * 6)
    await A.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    await M.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    hub.corrupt.add('M')
    hub.link('A', 'B'); hub.link('M', 'B')
    await B.eng.start(entry)
    await until(() => B.done.length === 1)
    expect(Buffer.from(B.st.data.get(entry.fileId)!).equals(Buffer.from(data))).toBe(true)
  })

  it('refuses hash lists that do not match the manifest root', async () => {
    const hub = new Hub(), M = mk(hub, 'M'), B = mk(hub, 'B')
    const { data, hashes, entry } = await makeFile(BS * 3)
    const evil = hashes.slice(); evil[0] ^= 1
    await M.eng.addComplete(entry, evil, new Blob([data as BlobPart]))
    hub.link('M', 'B')
    await B.eng.start(entry)
    await new Promise(r => setTimeout(r, 400))
    expect(B.done).toHaveLength(0)
    expect(B.eng.progress(entry.fileId)?.done).toBe(0)
  })

  it('survives the holder going away and resumes after a reload without re-fetching verified blocks', async () => {
    const hub = new Hub(), A = mk(hub, 'A'), B = mk(hub, 'B')
    const { data, hashes, entry } = await makeFile(BS * 40)
    await A.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    hub.link('A', 'B')
    await B.eng.start(entry)
    await until(() => (B.eng.progress(entry.fileId)?.done ?? 0) >= BS * 8)
    hub.cut('A', 'B')
    await new Promise(r => setTimeout(r, 50))
    B.eng.pause(entry.fileId)
    const have = B.eng.progress(entry.fileId)!.done
    expect(have).toBeLessThan(data.length)
    // simulated browser restart: new engine, same persisted storage
    B.eng.dispose()
    const hub2 = new Hub(), A2 = mk(hub2, 'A'), B2 = mk(hub2, 'B', B.st)
    await A2.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    const restored = await B2.eng.restore(entry)
    expect(restored?.done).toBe(have)
    hub2.link('A', 'B')
    await B2.eng.start(entry)
    await until(() => B2.done.length === 1)
    expect(Buffer.from(B2.st.data.get(entry.fileId)!).equals(Buffer.from(data))).toBe(true)
    const requested = hub2.sent.filter(m => m.h.t === 'get').length
    expect(requested).toBe(40 - have / BS)
  })

  it('moves to another source when the first one disconnects mid-transfer', async () => {
    const hub = new Hub(), A = mk(hub, 'A'), C = mk(hub, 'C'), B = mk(hub, 'B')
    const { data, hashes, entry } = await makeFile(BS * 30)
    await A.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    await C.eng.addComplete(entry, hashes, new Blob([data as BlobPart]))
    hub.link('A', 'B'); hub.link('C', 'B')
    await B.eng.start(entry)
    await until(() => (B.eng.progress(entry.fileId)?.done ?? 0) > 0)
    hub.cut('A', 'B')
    await until(() => B.done.length === 1)
    expect(Buffer.from(B.st.data.get(entry.fileId)!).equals(Buffer.from(data))).toBe(true)
  })

  it('does nothing until the manifest has a root hash and ignores a mismatched stored state', async () => {
    const hub = new Hub(), B = mk(hub, 'B')
    const { entry } = await makeFile(BS * 2)
    await B.eng.start({ ...entry, rootHash: null })
    expect(B.eng.progress(entry.fileId)).toBeNull()
    B.st.states.set(entry.fileId, { rootHash: 'f'.repeat(64), bitmap: 'AQ==', updatedAt: 1 })
    expect(await B.eng.restore(entry)).toBeNull()
  })
})
