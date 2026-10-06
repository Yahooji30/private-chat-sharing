import { LIMITS, type FileEntry, type FileMeta } from '@sync/shared'
import { Engine, type EntryInfo, type Progress } from '~/lib/webrtc/engine'
import { Mesh } from '~/lib/webrtc/mesh'
import { blockCount, toHex } from '~/lib/webrtc/protocol'
import { WorkerStorage } from '~/lib/webrtc/storage'

export type FileStatus = 'preparing' | 'reselect' | 'remote' | 'downloading' | 'paused' | 'complete' | 'offline'
export interface FileItem {
  entry: FileEntry
  status: FileStatus
  done: number
  speed: number
  sources: number
  hashing: number
  blob?: Blob
  preview?: string
}

const AUTO_MAX = 50 * 1024 * 1024
const NO_OPFS_MAX = 500 * 1024 * 1024
const newId = (): string => toHex(crypto.getRandomValues(new Uint8Array(10)))

export const useFiles = defineStore('files', () => {
  const items = ref<FileItem[]>([])
  const opfs = ref(true)
  const blocked = ref(false)
  const toast = useToast()
  const app = useApp()
  let storage: WorkerStorage, engine: Engine, mesh: Mesh
  let started = false
  const hashes = new Map<string, Uint8Array>()

  const find = (id: string): FileItem | undefined => items.value.find(i => i.entry.fileId === id)
  const info = (e: FileEntry): EntryInfo => ({ fileId: e.fileId, size: e.size, blockSize: e.blockSize, rootHash: e.rootHash })
  const peerIds = (): string[] => app.peers.filter(p => !p.self).map(p => p.deviceId)
  const holderOnline = (e: FileEntry): boolean => e.holders.some(h => peerIds().includes(h))

  function patch(id: string, p: Partial<FileItem>): void {
    const i = items.value.findIndex(x => x.entry.fileId === id)
    const cur = items.value[i]
    if (cur) items.value[i] = { ...cur, ...p }
  }

  function applyProgress(p: Progress): void {
    const it = find(p.fileId)
    if (!it) return
    const status: FileStatus = p.state === 'complete' ? 'complete' : p.state === 'running' ? 'downloading' : 'paused'
    patch(p.fileId, { done: p.done, speed: p.speed, sources: p.sources, status })
  }

  function idleStatus(e: FileEntry): FileStatus {
    return e.rootHash === null ? 'preparing' : 'remote'
  }

  async function addEntries(list: FileEntry[]): Promise<void> {
    for (const e of list) {
      if (find(e.fileId)) continue
      items.value.push({ entry: e, status: idleStatus(e), done: 0, speed: 0, sources: 0, hashing: 0 })
      const p = await engine.restore(info(e))
      if (p) applyProgress(p)
      else if (e.addedBy === app.device?.id && e.rootHash && !engine.isLocal(e.fileId)) patch(e.fileId, { status: 'reselect' })
      if (e.rootHash) maybeAuto(e)
    }
  }

  function maybeAuto(e: FileEntry): void {
    const it = find(e.fileId)
    if (app.autoDownload && e.size <= AUTO_MAX && e.rootHash && it && (it.status === 'remote') && e.addedBy !== app.device?.id) void download(e.fileId)
  }

  async function init(): Promise<void> {
    if (started || !app.device) return
    started = true
    storage = new WorkerStorage()
    opfs.value = (await storage.caps()).opfs
    const sock = spaceSocket()
    const ice = await api<{ iceServers: RTCIceServer[] }>('/rtc/ice').then(r => r.iceServers, () => [{ urls: 'stun:stun.l.google.com:19302' }])
    mesh = new Mesh(app.device.id, ice, {
      signal: (to, data) => void emitAck('rtc:signal', { to, data }),
      onOpen: p => engine.onPeerOpen(p), onClose: p => engine.onPeerClose(p),
      onFrame: (p, h, d) => engine.onFrame(p, h, d),
      onBlocked: () => { blocked.value = true },
    })
    engine = new Engine(storage, mesh, {
      progress: applyProgress,
      complete: id => { patch(id, { status: 'complete' }); void maybePreview(id) },
      holder: id => void emitAck('files:holder', { fileId: id }),
      failed: (id, r) => toast.err(`${find(id)?.entry.name ?? 'File'}: ${r}`),
    })
    sock.on('rtc:signal', (m: { from: string; data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit } }) => void mesh.onSignal(m.from, m.data))
    sock.on('presence:list', () => mesh.sync(peerIds()))
    sock.on('files:added', (l: FileEntry[]) => void addEntries(l))
    sock.on('files:ready', (m: { fileId: string; rootHash: string }) => {
      const it = find(m.fileId)
      if (!it) return
      const entry = { ...it.entry, rootHash: m.rootHash }
      patch(m.fileId, { entry, status: it.status === 'preparing' ? 'remote' : it.status })
      maybeAuto(entry)
    })
    sock.on('files:holders', (m: { fileId: string; holders: string[] }) => {
      const it = find(m.fileId)
      if (!it) return
      const holders = [...new Set([...it.entry.holders, ...m.holders])]
      patch(m.fileId, { entry: { ...it.entry, holders } })
    })
    sock.on('files:removed', (m: { fileId: string }) => void dropLocal(m.fileId))
    sock.on('files:cleared', () => { for (const i of [...items.value]) void dropLocal(i.entry.fileId) })
    sock.on('connect', () => { void reload(); mesh.sync(peerIds()) })
    setInterval(() => { mesh.sync(peerIds()); engine.announcePartial(); engine.resumeAll() }, 10_000)
    window.addEventListener('pagehide', () => { for (const i of items.value) if (i.status === 'downloading') engine.pause(i.entry.fileId) })
    await reload()
  }

  async function reload(): Promise<void> {
    const list = await api<FileEntry[]>('/files')
    await storage.gc(list.map(e => e.fileId))
    const ids = new Set(list.map(e => e.fileId))
    for (const i of [...items.value]) if (!ids.has(i.entry.fileId)) await dropLocal(i.entry.fileId)
    await addEntries(list)
    mesh.sync(peerIds())
  }

  async function dropLocal(id: string): Promise<void> {
    const it = find(id)
    if (it?.preview) URL.revokeObjectURL(it.preview)
    items.value = items.value.filter(i => i.entry.fileId !== id)
    hashes.delete(id)
    await engine.cancel(id)
  }

  async function thumbOf(file: File): Promise<string | undefined> {
    if (!file.type.startsWith('image/') || file.size > 30 * 1024 * 1024) return undefined
    try {
      const bmp = await createImageBitmap(file)
      const s = Math.min(1, 160 / Math.max(bmp.width, bmp.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s))
      c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height)
      const url = c.toDataURL('image/webp', 0.7)
      return url.length <= 30_000 ? url : undefined
    } catch { return undefined }
  }

  async function addFiles(files: File[]): Promise<void> {
    if (!started) return
    for (const f of files) {
      if (f.size === 0) { toast.warn(`${f.name} is empty`); continue }
      if (f.size > (opfs.value ? 4 * 1024 ** 3 : NO_OPFS_MAX)) { toast.err(`${f.name} is too large${opfs.value ? '' : ' for this browser'}`); continue }
      if (items.value.length >= LIMITS.maxFiles) { toast.err('File limit reached'); break }
      const again = items.value.find(i => i.status === 'reselect' && i.entry.name === f.name && i.entry.size === f.size)
      if (again) { void resumeShare(again, f); continue }
      const meta: FileMeta = { fileId: newId(), name: f.name.slice(0, LIMITS.fileNameChars), mime: f.type || 'application/octet-stream', size: f.size, blockSize: LIMITS.blockSize }
      const thumb = await thumbOf(f)
      const r = await emitAck<{ ok?: boolean; error?: string }>('files:add', thumb ? { ...meta, thumb } : meta)
      if (!r.ok) { toast.err(r.error === 'FILE_LIMIT' ? 'File limit reached' : 'Could not add file'); continue }
      void share(meta.fileId, f)
    }
  }

  async function share(fileId: string, f: File): Promise<void> {
    await waitFor(() => !!find(fileId))
    const it = find(fileId)!
    patch(fileId, { blob: f, status: 'preparing' })
    try {
      const { hashes: h, rootHash } = await storage.hash(f, it.entry.blockSize, n => patch(fileId, { hashing: n }))
      const entry = { ...it.entry, rootHash }
      patch(fileId, { entry, status: 'complete', done: f.size, hashing: 0 })
      await engine.addComplete(info(entry), h, f)
      const r = await emitAck<{ ok?: boolean }>('files:ready', { fileId, rootHash })
      if (!r.ok) throw new Error('rejected')
      void storage.copyFrom(fileId, f, entry.blockSize).then(async () => {
        await storage.saveState(fileId, { rootHash, bitmap: bitmapFull(entry), updatedAt: Date.now() })
      }).catch(() => undefined)
    } catch { toast.err(`Could not share ${f.name}`); void remove(fileId) }
  }

  async function resumeShare(it: FileItem, f: File): Promise<void> {
    const { hashes: h, rootHash } = await storage.hash(f, it.entry.blockSize, () => undefined)
    if (rootHash !== it.entry.rootHash) return toast.err('That file does not match the shared one')
    await engine.addComplete(info(it.entry), h, f)
    patch(it.entry.fileId, { status: 'complete', blob: f, done: f.size })
    await emitAck('files:holder', { fileId: it.entry.fileId })
    toast.ok('Sharing resumed')
  }

  const bitmapFull = (e: FileEntry): string => {
    const n = blockCount(e.size, e.blockSize), b = new Uint8Array(Math.ceil(n / 8)).fill(255)
    return btoa(String.fromCharCode(...b))
  }

  async function download(id: string): Promise<void> {
    const it = find(id)
    if (!it?.entry.rootHash) return
    if (!opfs.value && it.entry.size > NO_OPFS_MAX) return toast.err('This browser cannot store files this large')
    patch(id, { status: 'downloading' })
    await engine.start(info(it.entry))
    if (!holderOnline(it.entry) && !engine.isLocal(id)) toast.warn('Waiting for a device that has this file to come online')
  }
  function pause(id: string): void { engine.pause(id) }
  async function resume(id: string): Promise<void> { await download(id) }
  async function cancel(id: string): Promise<void> {
    const it = find(id)
    await engine.cancel(id)
    if (it) patch(id, { status: idleStatus(it.entry), done: 0, speed: 0, sources: 0 })
  }
  async function remove(id: string): Promise<void> { await emitAck('files:remove', { fileId: id }); await dropLocal(id) }
  async function clearAll(): Promise<void> { await emitAck('files:clear', {}); for (const i of [...items.value]) await dropLocal(i.entry.fileId) }

  async function fileFor(id: string): Promise<File | null> {
    const it = find(id)
    if (!it) return null
    if (it.blob) return new File([it.blob], it.entry.name, { type: it.entry.mime })
    const f = await storage.fileOf(id)
    return f ? new File([f], it.entry.name, { type: it.entry.mime }) : null
  }

  async function save(id: string): Promise<void> {
    const f = await fileFor(id)
    if (!f) return toast.err('File is not available on this device yet')
    await saveBlob(f, f.name)
  }

  async function saveBlob(b: Blob, name: string): Promise<void> {
    const w = window as unknown as { showSaveFilePicker?: (o: { suggestedName: string }) => Promise<{ createWritable(): Promise<WritableStream> }> }
    if (w.showSaveFilePicker) {
      try { const h = await w.showSaveFilePicker({ suggestedName: name }); await b.stream().pipeTo(await h.createWritable()); return } catch (e) { if ((e as Error).name === 'AbortError') return }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b); a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
  }

  async function maybePreview(id: string): Promise<void> {
    const it = find(id)
    if (!it || !/^(image|video|audio)\//.test(it.entry.mime) || it.entry.size > 200 * 1024 * 1024) return
    const f = await fileFor(id)
    if (f) patch(id, { preview: URL.createObjectURL(f) })
  }
  async function previewUrl(id: string): Promise<string | null> {
    const it = find(id)
    if (it?.preview) return it.preview
    const f = await fileFor(id)
    if (!f) return null
    const url = URL.createObjectURL(f)
    patch(id, { preview: url })
    return url
  }
  async function previewText(id: string): Promise<string | null> {
    const f = await fileFor(id)
    return f ? (await f.slice(0, 200_000).text()) : null
  }

  async function zipAll(): Promise<void> {
    const done = items.value.filter(i => i.status === 'complete')
    if (!done.length) return toast.warn('Download files first, then zip them')
    const { downloadZip } = await import('client-zip')
    const used = new Set<string>()
    const inputs: { name: string; input: File }[] = []
    for (const i of done) {
      const f = await fileFor(i.entry.fileId)
      if (!f) continue
      let n = i.entry.name
      for (let k = 2; used.has(n); k++) n = i.entry.name.replace(/(\.[^.]*)?$/, ` (${k})$1`)
      used.add(n); inputs.push({ name: n, input: f })
    }
    await saveBlob(await downloadZip(inputs).blob(), 'files.zip')
  }

  async function downloadMissing(): Promise<void> {
    for (const i of items.value) if (['remote', 'paused'].includes(i.status) && i.entry.rootHash) await download(i.entry.fileId)
  }

  const waitFor = async (fn: () => boolean): Promise<void> => { for (let i = 0; i < 100 && !fn(); i++) await new Promise(r => setTimeout(r, 20)) }

  return { items, opfs, blocked, init, addFiles, download, pause, resume, cancel, remove, clearAll, save, previewUrl, previewText, zipAll, downloadMissing, holderOnline }
})
