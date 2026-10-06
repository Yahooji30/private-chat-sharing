export const CHUNK = 64 * 1024
export const PER_PEER = 8
export const TOTAL_INFLIGHT = 24
export const STALL_MS = 20_000

export interface Header { t: string; f?: string; [k: string]: unknown }
export interface Frame { h: Header; payload: Uint8Array }

export function encodeFrame(h: Header, payload?: Uint8Array): Uint8Array {
  const head = new TextEncoder().encode(JSON.stringify(h))
  const out = new Uint8Array(4 + head.length + (payload?.length ?? 0))
  new DataView(out.buffer).setUint32(0, head.length)
  out.set(head, 4)
  if (payload) out.set(payload, 4 + head.length)
  return out
}

export function decodeFrame(buf: Uint8Array): Frame {
  const len = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0)
  if (len > buf.length - 4) throw new Error('bad frame')
  const h = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + len))) as Header
  return { h, payload: buf.subarray(4 + len) }
}

export const blockCount = (size: number, bs: number): number => Math.ceil(size / bs)
export const blockLen = (size: number, bs: number, i: number): number => Math.min(bs, size - i * bs)

export const bmNew = (n: number): Uint8Array => new Uint8Array(Math.ceil(n / 8))
export const bmGet = (b: Uint8Array, i: number): boolean => ((b[i >> 3] ?? 0) & (1 << (i & 7))) !== 0
export function bmSet(b: Uint8Array, i: number): void { b[i >> 3] = (b[i >> 3] ?? 0) | (1 << (i & 7)) }
export function bmCount(b: Uint8Array, n: number): number { let c = 0; for (let i = 0; i < n; i++) if (bmGet(b, i)) c++; return c }
export function bmFull(n: number): Uint8Array { const b = bmNew(n); for (let i = 0; i < n; i++) bmSet(b, i); return b }

export const toB64 = (u: Uint8Array): string => { let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s) }
export const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0))
export const toHex = (u: Uint8Array): string => [...u].map(b => b.toString(16).padStart(2, '0')).join('')

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource))
}

/** rootHash = SHA-256 over the concatenated per-block hashes. */
export async function rootOf(hashes: Uint8Array): Promise<string> { return toHex(await sha256(hashes)) }

export const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i])
