import { TextClient, transformPos, type HistoryEntry, type Op } from '@sync/shared'

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline'

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
    if (el && moves.length && document.activeElement === el) {
      const start = moves.reduce((p, op) => transformPos(p, op), from), end = moves.reduce((p, op) => transformPos(p, op), to)
      void nextTick(() => el.setSelectionRange(start, end))
    }
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

  function bind(el: () => HTMLTextAreaElement | null): void {
    box = el
    const sock = spaceSocket()
    const onOp = (m: { rev: number; op: Op }): void => {
      show(client.receive({ rev: m.rev, op: m.op }))
      if (client.gap) watchGap()
    }
    const onReset = (m: { content: string; rev: number }): void => { client.load(m.content, m.rev); show([]) }
    const onConnect = (): void => { if (loaded) run(() => catchUp()) }
    const onDisconnect = (): void => { if (client.unsent) state.value = 'offline' }
    sock.on('text:op', onOp)
    sock.on('text:reset', onReset)
    sock.on('connect', onConnect)
    sock.on('disconnect', onDisconnect)
    const flush = (): void => { if (client.unsent) run(send) }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', flush)
    onBeforeUnmount(() => {
      sock.off('text:op', onOp); sock.off('text:reset', onReset); sock.off('connect', onConnect); sock.off('disconnect', onDisconnect)
      window.removeEventListener('pagehide', flush); window.removeEventListener('online', flush)
      clearTimeout(sendTimer); clearTimeout(gapTimer)
    })
  }

  return { text, state, savedAt, tooBig, edit, load, bind }
}
