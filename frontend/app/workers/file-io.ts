/// <reference lib="webworker" />
// Dedicated worker: hashing and OPFS random-access I/O so the UI thread stays free.
import { blockCount, rootOf, sha256 } from '../lib/webrtc/protocol'

type Req = { id: number; op: string; [k: string]: unknown }
const ctx = self as unknown as DedicatedWorkerGlobalScope

interface Handle { read(b: Uint8Array, o: { at: number }): number; write(b: Uint8Array, o: { at: number }): number; truncate(n: number): void; getSize(): number; flush(): void; close(): void }
interface FileHandle { createSyncAccessHandle(): Promise<Handle> }
interface Dir { getDirectoryHandle(n: string, o?: { create: boolean }): Promise<Dir>; getFileHandle(n: string, o?: { create: boolean }): Promise<FileHandle>; removeEntry(n: string, o?: { recursive: boolean }): Promise<void>; entries(): AsyncIterable<[string, unknown]> }

const hasOpfs = typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory
const handles = new Map<string, Handle>()
const mem = new Map<string, Uint8Array>()
const memMeta = new Map<string, Uint8Array>()

async function fileDir(id: string, create = true): Promise<Dir> {
  const root = (await navigator.storage.getDirectory()) as unknown as Dir
  return (await (await root.getDirectoryHandle('files', { create: true })).getDirectoryHandle(id, { create }))
}

async function small(id: string, name: string, write?: Uint8Array): Promise<Uint8Array | null> {
  if (!hasOpfs) { const k = `${id}/${name}`; if (write) { memMeta.set(k, write); return null } return memMeta.get(k) ?? null }
  try {
    const fh = await (await fileDir(id, !!write)).getFileHandle(name, { create: !!write })
    const h = await fh.createSyncAccessHandle()
    try {
      if (write) { h.truncate(0); h.write(write, { at: 0 }); h.flush(); return null }
      const out = new Uint8Array(h.getSize())
      h.read(out, { at: 0 })
      return out
    } finally { h.close() }
  } catch { return null }
}

async function dataHandle(id: string, size?: number): Promise<Handle> {
  let h = handles.get(id)
  if (!h) {
    const fh = await (await fileDir(id)).getFileHandle('data', { create: true })
    h = await fh.createSyncAccessHandle()
    handles.set(id, h)
  }
  if (size !== undefined && h.getSize() !== size) h.truncate(size)
  return h
}

function release(id: string): void { handles.get(id)?.close(); handles.delete(id) }

const ops: Record<string, (r: Req) => Promise<unknown>> = {
  caps: async () => ({ opfs: hasOpfs }),

  async hash(r) {
    const file = r.file as Blob, bs = r.blockSize as number
    const n = blockCount(file.size, bs), hashes = new Uint8Array(32 * n)
    for (let b = 0; b < n; b++) {
      hashes.set(await sha256(new Uint8Array(await file.slice(b * bs, (b + 1) * bs).arrayBuffer())), b * 32)
      if (b % 4 === 3 || b === n - 1) ctx.postMessage({ id: r.id, progress: Math.min(file.size, (b + 1) * bs) })
    }
    return { hashes, rootHash: await rootOf(hashes) }
  },

  async open(r) {
    const id = r.fileId as string, size = r.size as number
    if (!hasOpfs) { if (!mem.has(id)) mem.set(id, new Uint8Array(size)); return null }
    await dataHandle(id, size)
    return null
  },
  async read(r) {
    const id = r.fileId as string, off = r.offset as number, len = r.len as number
    if (!hasOpfs) return mem.get(id)?.slice(off, off + len) ?? null
    const h = await dataHandle(id)
    const out = new Uint8Array(len)
    return h.read(out, { at: off }) === len ? out : null
  },
  async write(r) {
    const id = r.fileId as string, data = r.data as Uint8Array, off = r.offset as number
    if (!hasOpfs) { mem.get(id)?.set(data, off); return null }
    ;(await dataHandle(id)).write(data, { at: off })
    return null
  },
  async close(r) { const id = r.fileId as string; if (hasOpfs) { handles.get(id)?.flush(); release(id) } return null },
  async copyFrom(r) {
    const id = r.fileId as string, file = r.file as Blob, bs = r.blockSize as number
    if (!hasOpfs) { mem.set(id, new Uint8Array(await file.arrayBuffer())); return null }
    const h = await dataHandle(id, file.size)
    for (let off = 0; off < file.size; off += bs) h.write(new Uint8Array(await file.slice(off, off + bs).arrayBuffer()), { at: off })
    h.flush()
    return null
  },
  async remove(r) {
    const id = r.fileId as string
    release(id); mem.delete(id)
    for (const k of [...memMeta.keys()]) if (k.startsWith(`${id}/`)) memMeta.delete(k)
    if (hasOpfs) {
      const root = (await navigator.storage.getDirectory()) as unknown as Dir
      try { await (await root.getDirectoryHandle('files')).removeEntry(id, { recursive: true }) } catch { /* already gone */ }
    }
    return null
  },
  async loadState(r) { const b = await small(r.fileId as string, 'state.json'); return b ? JSON.parse(new TextDecoder().decode(b)) : null },
  async saveState(r) { await small(r.fileId as string, 'state.json', new TextEncoder().encode(JSON.stringify(r.state))); return null },
  async loadHashes(r) { return small(r.fileId as string, 'hashes.bin') },
  async saveHashes(r) { await small(r.fileId as string, 'hashes.bin', r.data as Uint8Array); return null },
  async gc(r) {
    const keep = new Set(r.keep as string[])
    if (!hasOpfs) return null
    const root = (await navigator.storage.getDirectory()) as unknown as Dir
    try {
      const dir = await root.getDirectoryHandle('files')
      for await (const [name] of dir.entries()) if (!keep.has(name)) await dir.removeEntry(name, { recursive: true })
    } catch { /* nothing stored yet */ }
    return null
  },
  async release(r) { release(r.fileId as string); return null },
  async list() {
    if (!hasOpfs) return [...mem.keys()]
    const out: string[] = []
    const root = (await navigator.storage.getDirectory()) as unknown as Dir
    try { for await (const [name] of (await root.getDirectoryHandle('files')).entries()) out.push(name) } catch { /* none */ }
    return out
  },
}

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const r = e.data
  try {
    const result = await ops[r.op]!(r)
    const transfer = result instanceof Uint8Array ? [result.buffer as ArrayBuffer] : []
    ctx.postMessage({ id: r.id, ok: true, result }, transfer)
  } catch (err) {
    ctx.postMessage({ id: r.id, ok: false, error: String(err) })
  }
}
