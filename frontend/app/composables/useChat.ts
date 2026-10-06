import type { Socket } from 'socket.io-client'
import { LIMITS } from '@sync/shared'
import { decryptMsg, deriveKeys, encryptMsg, randomSalt, type RoomKeys } from '~/lib/crypto/chat'

export interface ChatMsg { id: string; slot: number; mine: boolean; text: string }
export type ChatPhase = 'password' | 'joining' | 'live' | 'reconnecting' | 'full' | 'closed' | 'lost'

/** Keys live only in module memory: reload or leave = they are gone (by design). */
const keyring = new Map<string, RoomKeys>()
export const hasKeys = (code: string): boolean => keyring.has(code)
export const rememberKeys = (code: string, k: RoomKeys): void => { keyring.set(code, k) }

export async function createRoom(password: string, code?: string): Promise<{ code: string; manageToken: string }> {
  const kdfSalt = randomSalt()
  const keys = await deriveKeys(password, kdfSalt)
  const r = await api<{ code: string; manageToken: string }>('/chat/rooms', { method: 'POST', body: { code: code || undefined, authKey: keys.authKey, kdfSalt } })
  rememberKeys(r.code, keys)
  try { localStorage.setItem(`sync:chat:manage:${r.code}`, r.manageToken) } catch { /* private mode */ }
  return r
}

export function useChat(code: string) {
  const phase = ref<ChatPhase>(hasKeys(code) ? 'joining' : 'password')
  const error = ref('')
  const msgs = ref<ChatMsg[]>([])
  const members = reactive({ count: 0, slots: [false, false, false, false], palette: [0, 1, 2, 3], slot: -1, color: 0 })
  const typing = ref<Set<number>>(new Set())
  const system = ref<{ id: number; text: string }[]>([])
  let sock: Socket | null = null
  let token = ''
  let lastId = '0'
  let left = false
  let seq = 0
  let typingTimer: ReturnType<typeof setTimeout> | undefined
  let resumeTries = 0

  const push = (m: ChatMsg): void => { msgs.value = [...msgs.value.slice(-(499)), m] }
  const note = (text: string): void => { system.value = [...system.value.slice(-20), { id: ++seq, text }]; msgs.value = [...msgs.value, { id: `sys${seq}`, slot: -1, mine: false, text }] }

  async function unlock(password: string): Promise<boolean> {
    error.value = ''
    phase.value = 'joining'
    try {
      const { kdfSalt } = await api<{ kdfSalt: string }>(`/chat/rooms/${code}/salt`)
      const keys = await deriveKeys(password, kdfSalt)
      const { ticket } = await api<{ ticket: string }>(`/chat/rooms/${code}/ticket`, { method: 'POST', body: { authKey: keys.authKey } })
      rememberKeys(code, keys)
      await connect({ ticket })
      return true
    } catch (e) {
      const f = e as ApiFailure
      error.value = f.code === 'ROOM_BAD_AUTH' ? 'Wrong password or room code.' : f.message
      if ((phase.value as ChatPhase) !== 'full') phase.value = 'password'
      return false
    }
  }

  async function join(): Promise<void> {
    const keys = keyring.get(code)
    if (!keys) { phase.value = 'password'; return }
    try {
      const { ticket } = await api<{ ticket: string }>(`/chat/rooms/${code}/ticket`, { method: 'POST', body: { authKey: keys.authKey } })
      await connect({ ticket })
    } catch (e) { error.value = (e as Error).message; phase.value = 'password'; keyring.delete(code) }
  }

  function connect(auth: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => attach(chatSocket(auth), { resolve, reject }))
  }

  function attach(s: Socket, first?: { resolve: () => void; reject: (e: Error) => void }): void {
    sock?.removeAllListeners().disconnect()
    sock = s
    s.on('connect_error', e => {
      if (e.message === 'full') { phase.value = 'full'; first?.reject(new Error('Room is full (4/4).')) }
      else if (first) first.reject(new Error('Could not join. The link or ticket expired.'))
      else if (phase.value === 'reconnecting') retry()
    })
    s.on('chat:members', (m: { count: number; slots: boolean[]; palette: number[]; slot?: number; color?: number; resumeToken?: string; lastId?: string }) => {
      members.count = m.count; members.slots = m.slots; members.palette = m.palette
      if (m.slot !== undefined) members.slot = m.slot
      if (m.color !== undefined) members.color = m.color
      if (m.resumeToken) token = m.resumeToken
      if (m.lastId) lastId = m.lastId
      if (phase.value !== 'live') { phase.value = 'live'; resumeTries = 0; first?.resolve() }
    })
    s.on('chat:msg', async (m: { id: string; slot: number; iv: string; ct: string }) => {
      const k = keyring.get(code)
      const text = k ? await decryptMsg(k.encKey, m, code) : null
      lastId = m.id
      push({ id: m.id, slot: m.slot, mine: false, text: text ?? '[could not decrypt]' })
      const t = new Set(typing.value); t.delete(m.slot); typing.value = t
    })
    s.on('chat:typing', (m: { slot: number; on: boolean }) => {
      const t = new Set(typing.value)
      if (m.on) t.add(m.slot); else t.delete(m.slot)
      typing.value = t
    })
    s.on('chat:system', (m: { kind: 'joined' | 'left' }) => note(m.kind === 'joined' ? 'Someone joined' : 'Someone left'))
    s.on('chat:closed', () => { left = true; wipe(); phase.value = 'closed' })
    s.on('disconnect', reason => {
      if (left || reason === 'io client disconnect') return
      phase.value = 'reconnecting'
      retry()
    })
  }

  if (import.meta.client) {
    useEventListener(window, 'offline', () => { if (phase.value === 'live') { phase.value = 'reconnecting'; sock?.disconnect() } })
    useEventListener(window, 'online', () => { if (phase.value === 'reconnecting') { resumeTries = 0; retry() } })
  }

  function retry(): void {
    if (left || !token) { phase.value = 'lost'; return }
    if (++resumeTries > 8) { phase.value = 'lost'; wipe(); return }
    setTimeout(() => { if (!left) attach(chatSocket({ resume: { code, token, lastId } })) }, Math.min(1000 * resumeTries, 5000))
  }

  async function send(text: string): Promise<boolean> {
    const k = keyring.get(code)
    const t = text.trim()
    if (!k || !sock?.connected || !t || t.length > LIMITS.chatMsgChars) return false
    const payload = await encryptMsg(k.encKey, t, code)
    const r = await sock.timeout(5000).emitWithAck('chat:msg', payload).catch(() => ({ error: 'TIMEOUT' })) as { id?: string; error?: string }
    if (!r.id) return false
    lastId = r.id
    push({ id: r.id, slot: members.slot, mine: true, text: t })
    return true
  }

  function setTyping(on: boolean): void {
    clearTimeout(typingTimer)
    sock?.emit('chat:typing', { on })
    if (on) typingTimer = setTimeout(() => sock?.emit('chat:typing', { on: false }), 3000)
  }

  function wipe(): void { msgs.value = []; system.value = []; keyring.delete(code); token = '' }
  function leave(): void { left = true; sock?.emit('chat:leave'); sock?.disconnect(); wipe(); phase.value = 'password' }
  function dispose(): void { left = true; sock?.disconnect(); msgs.value = [] }

  return { phase, error, msgs, members, typing, unlock, join, send, setTyping, leave, dispose }
}
