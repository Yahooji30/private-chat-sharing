import type { FileState, Storage } from './engine'

type Pending = { res: (v: unknown) => void; rej: (e: Error) => void; progress?: (n: number) => void }

/** Main-thread RPC wrapper around the file-io worker. */
export class WorkerStorage implements Storage {
  private w: Worker
  private seq = 0
  private pending = new Map<number, Pending>()

  constructor() {
    this.w = new Worker(new URL('../../workers/file-io.ts', import.meta.url), { type: 'module' })
    this.w.onmessage = (e: MessageEvent<{ id: number; ok?: boolean; result?: unknown; error?: string; progress?: number }>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      if (e.data.progress !== undefined) return p.progress?.(e.data.progress)
      this.pending.delete(e.data.id)
      if (e.data.ok) p.res(e.data.result); else p.rej(new Error(e.data.error))
    }
  }

  private call<T>(op: string, args: Record<string, unknown> = {}, transfer: Transferable[] = [], progress?: (n: number) => void): Promise<T> {
    const id = ++this.seq
    return new Promise<T>((res, rej) => {
      this.pending.set(id, { res: res as (v: unknown) => void, rej, progress })
      this.w.postMessage({ id, op, ...args }, transfer)
    })
  }

  caps = (): Promise<{ opfs: boolean }> => this.call('caps')
  hash = (file: Blob, blockSize: number, progress: (n: number) => void): Promise<{ hashes: Uint8Array; rootHash: string }> => this.call('hash', { file, blockSize }, [], progress)
  copyFrom = (fileId: string, file: Blob, blockSize: number): Promise<null> => this.call('copyFrom', { fileId, file, blockSize })
  open = (fileId: string, size: number): Promise<void> => this.call('open', { fileId, size })
  read = (fileId: string, offset: number, len: number): Promise<Uint8Array | null> => this.call('read', { fileId, offset, len })
  write = (fileId: string, offset: number, data: Uint8Array): Promise<void> => this.call('write', { fileId, offset, data }, [data.buffer as ArrayBuffer])
  close = (fileId: string): Promise<void> => this.call('close', { fileId })
  release = (fileId: string): Promise<void> => this.call('release', { fileId })
  loadState = (fileId: string): Promise<FileState | null> => this.call('loadState', { fileId })
  saveState = (fileId: string, state: FileState): Promise<void> => this.call('saveState', { fileId, state })
  loadHashes = (fileId: string): Promise<Uint8Array | null> => this.call('loadHashes', { fileId })
  saveHashes = (fileId: string, data: Uint8Array): Promise<void> => this.call('saveHashes', { fileId, data: data.slice() }, [])
  remove = (fileId: string): Promise<void> => this.call('remove', { fileId })
  gc = (keep: string[]): Promise<void> => this.call('gc', { keep })

  /** Disk-backed File for a completed download (OPFS) or null when only in memory. */
  async fileOf(fileId: string): Promise<File | null> {
    await this.release(fileId)
    try {
      const root = await navigator.storage.getDirectory()
      const dir = await (await root.getDirectoryHandle('files')).getDirectoryHandle(fileId)
      return await (await dir.getFileHandle('data')).getFile()
    } catch { return null }
  }
}
