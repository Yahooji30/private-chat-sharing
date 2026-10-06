const enc = new TextEncoder(), dec = new TextDecoder()
const ITER = 600_000

export const b64 = (u: Uint8Array): string => { let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s) }
export const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0))
export const randomSalt = (): string => b64(crypto.getRandomValues(new Uint8Array(16)))

async function hkdf(master: CryptoKey, info: string): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(info) }, master, 256)
}

export interface RoomKeys { authKey: string; encKey: CryptoKey }

/** password -> PBKDF2 -> HKDF(auth) sent to server, HKDF(enc) kept in memory as a non-extractable AES-GCM key. */
export async function deriveKeys(password: string, kdfSalt: string, iterations = ITER): Promise<RoomKeys> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(kdfSalt) as BufferSource, iterations }, base, 256)
  const master = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits'])
  const encKey = await crypto.subtle.importKey('raw', await hkdf(master, 'sync-chat-enc'), 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { authKey: b64(new Uint8Array(await hkdf(master, 'sync-chat-auth'))), encKey }
}

export async function encryptMsg(key: CryptoKey, text: string, room: string): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(room) }, key, enc.encode(text))
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) }
}

export async function decryptMsg(key: CryptoKey, m: { iv: string; ct: string }, room: string): Promise<string | null> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m.iv) as BufferSource, additionalData: enc.encode(room) }, key, unb64(m.ct) as BufferSource)
    return dec.decode(pt)
  } catch { return null }
}

/** 0..4 rough strength score for the meter. */
export function strength(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return s
}
