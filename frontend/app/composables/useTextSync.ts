import { TextClient, diffOp, transformPos, type HistoryEntry, type Op } from '@sync/shared'

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline'
/** Where another device's cursor (or selection) is in the text on screen. */
export interface RemoteCursor { deviceId: string; start: number; end: number; at: number }

type Answer = { rev?: number; opId?: string; stale?: { content: string; rev: number; applied: boolean }; error?: string }
type Missed = { ops: HistoryEntry[]; rev: number } | { content: string; rev: number; applied: boolean } | { error: string }

/**
 * The shared scratchpad. Every change you make goes to the server as a small edit, and every change from another device is
 * fitted past what you have typed since before it is shown, so two people can type at once without losing keystrokes and the
 * cursor stays with the text around it. The rules live in @sync/shared (textsync.ts); this file only connects them to the
 * socket and the text box.
 */
export function useTextSync() {
  const client = new TextClient()
  const text = ref('')
  const state = ref<SaveState>('idle')
  const savedAt = ref(0)
  const cursors = ref<Record<string, RemoteCursor>>({})
  const tooBig = computed(() => text.value.length >= useApp().textMax)
  let box: () => HTMLTextAreaElement | null = () => null
  let loaded = false
  let sendTimer: ReturnType<typeof setTimeout> | undefined
  let gapTimer: ReturnType<typeof setTimeout> | undefined

  // one thing at a time: sending, catching up and loading never overlap
  let chain: Promise<unknown> = Promise.resolve()
  const run = (fn: () => Promise<void>): void => { chain = chain.then(fn).catch(() => undefined) }

  /** Shows what the client now holds, moving the cursor and selection with the text around them. */
  function show(moves: Op[]): void {
    const el = box()
    const from = el?.selectionStart ?? 0, to = el?.selectionEnd ?? 0
    text.value = client.doc
    if (moves.length) moveCursors(moves)
    if (el && moves.length && document.activeElement === el) {
      const start = moves.reduce((p, op) => transformPos(p, op), from), end = moves.reduce((p, op) => transformPos(p, op), to)
      void nextTick(() => el.setSelectionRange(start, end))
    }
  }

  /** The other people's cursors stay with the words around them when text changes before them. */
  function moveCursors(ops: Op[]): void {
    const next: Record<string, RemoteCursor> = {}
    const max = client.doc.length
    for (const [id, c] of Object.entries(cursors.value)) {
      const move = (p: number): number => Math.min(max, ops.reduce((x, op) => transformPos(x, op), p))
      next[id] = { ...c, start: move(c.start), end: move(c.end) }
    }
    cursors.value = next
  }

  function settled(): void {
    if (client.unsent) return
    state.value = 'saved'
    savedAt.value = Date.now()
  }

  function later(ms = 40): void {
    if (sendTimer) return
    sendTimer = setTimeout(() => { sendTimer = undefined; run(send) }, ms)
  }

  async function send(): Promise<void> {
    const out = client.outgoing()
    if (!out) return settled()
    if (!spaceSocket().connected) { state.value = 'offline'; return } // the reconnect picks it up
    state.value = 'saving'
    const r = await emitAck<Answer>('text:op', out)
    if (r.rev !== undefined) show(client.receive({ rev: r.rev, ack: true, opId: r.opId }))
    else if (r.stale) show(client.resync(r.stale.content, r.stale.rev, r.stale.applied, useApp().textMax))
    else if (r.error === 'BAD_REQUEST') await catchUp(true) // the server cannot make sense of it: take the server's text
    else { state.value = 'offline'; later(1500); return } // no answer, busy or rate limited: try again
    if (client.gap) watchGap()
    if (client.unsent) later(0)
    else settled()
  }

  /** Asks the server what happened while this device was away, or while a message went missing. */
  async function catchUp(force = false): Promise<void> {
    if (!spaceSocket().connected) return
    const r = await emitAck<Missed>('text:sync', { sinceRev: force ? -1 : client.rev, opId: client.outgoing()?.opId })
    if ('ops' in r) show(client.catchUp(r.ops))
    else if ('content' in r) show(client.resync(r.content, r.rev, r.applied, useApp().textMax))
    else { later(1500); return }
    if (client.unsent) later(0)
    else settled()
  }

  function watchGap(): void {
    if (gapTimer) return
    gapTimer = setTimeout(() => { gapTimer = undefined; if (client.gap) run(() => catchUp()) }, 1500)
  }

  /** The user changed the text. `caret` = where the cursor is right after the change. */
  function edit(next: string, caret?: number): void {
    if (Object.keys(cursors.value).length) moveCursors([diffOp(client.doc, next.slice(0, useApp().textMax), caret)])
    client.edit(next.slice(0, useApp().textMax), caret)
    text.value = client.doc
    state.value = 'saving'
    later()
  }

  async function load(): Promise<void> {
    const r = await api<{ content: string; rev: number }>('/text')
    client.load(r.content, r.rev)
    loaded = true
    show([])
    state.value = 'saved'
    savedAt.value = Date.now()
  }

  /** Tells the other devices where this cursor is (at most ~12 times a second). */
  let cursorTimer: ReturnType<typeof setTimeout> | undefined
  let lastSent = ''
  function sendCursor(gone = false): void {
    const el = box(), sock = spaceSocket()
    if (!el || !sock.connected || !loaded) return
    const key = gone || document.activeElement !== el ? 'gone' : `${el.selectionStart}:${el.selectionEnd}`
    if (key === lastSent) return
    lastSent = key
    sock.volatile.emit('text:cursor', key === 'gone' ? { start: -1, end: 0 } : { start: el.selectionStart, end: el.selectionEnd })
  }
  function cursorSoon(): void {
    if (cursorTimer) return
    cursorTimer = setTimeout(() => { cursorTimer = undefined; sendCursor() }, 80)
  }
  const onCursor = (m: { deviceId: string; start: number; end: number }): void => {
    if (m.start < 0) { const { [m.deviceId]: _gone, ...rest } = cursors.value; cursors.value = rest; return }
    const max = client.doc.length
    cursors.value = { ...cursors.value, [m.deviceId]: { deviceId: m.deviceId, start: Math.min(m.start, max), end: Math.min(m.end, max), at: Date.now() } }
  }

  function bind(el: () => HTMLTextAreaElement | null): void {
    box = el
    const sock = spaceSocket()
    const onOp = (m: { rev: number; op: Op }): void => {
      show(client.receive({ rev: m.rev, op: m.op }))
      if (client.gap) watchGap()
    }
    const onReset = (m: { content: string; rev: number }): void => { client.load(m.content, m.rev); show([]) }
    const onConnect = (): void => { lastSent = ''; if (loaded) run(() => catchUp()) }
    const onDisconnect = (): void => { if (client.unsent) state.value = 'offline' }
    sock.on('text:op', onOp)
    sock.on('text:cursor', onCursor)
    const onSelect = (): void => { if (document.activeElement === box()) cursorSoon() }
    const onBlur = (e: FocusEvent): void => { if (e.target === box()) sendCursor(true) }
    document.addEventListener('selectionchange', onSelect)
    document.addEventListener('focusout', onBlur)
    const away = (): void => { lastSent = ''; if (document.visibilityState === 'hidden') sendCursor(true) }
    document.addEventListener('visibilitychange', away)
    // a cursor not heard from for a minute belongs to a device that went away
    const sweep = setInterval(() => { const old = Date.now() - 60_000; const keep = Object.values(cursors.value).filter(c => c.at > old); if (keep.length !== Object.keys(cursors.value).length) cursors.value = Object.fromEntries(keep.map(c => [c.deviceId, c])) }, 15_000)
    sock.on('text:reset', onReset)
    sock.on('connect', onConnect)
    sock.on('disconnect', onDisconnect)
    const flush = (): void => { if (client.unsent) run(send) }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', flush)
    onBeforeUnmount(() => {
      sock.off('text:op', onOp); sock.off('text:cursor', onCursor); document.removeEventListener('selectionchange', onSelect); document.removeEventListener('visibilitychange', away); document.removeEventListener('focusout', onBlur); clearInterval(sweep); clearTimeout(cursorTimer); sock.off('text:reset', onReset); sock.off('connect', onConnect); sock.off('disconnect', onDisconnect)
      window.removeEventListener('pagehide', flush); window.removeEventListener('online', flush)
      clearTimeout(sendTimer); clearTimeout(gapTimer)
    })
  }

  return { text, state, savedAt, cursors, tooBig, edit, load, bind }
}
