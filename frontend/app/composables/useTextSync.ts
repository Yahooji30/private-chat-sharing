import { LIMITS } from '@sync/shared'

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline'

export function useTextSync() {
  const text = ref('')
  const state = ref<SaveState>('idle')
  const savedAt = ref(0)
  const rev = ref(0)
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const tooBig = computed(() => text.value.length >= LIMITS.textChars)

  async function send(): Promise<void> {
    if (!dirty) return
    const sock = spaceSocket()
    if (!sock.connected) { state.value = 'offline'; return }
    dirty = false
    state.value = 'saving'
    const content = text.value
    const r = await emitAck<{ rev?: number; error?: string }>('text:update', { content, baseRev: rev.value })
    if (r.rev !== undefined) { rev.value = r.rev; if (!dirty) { state.value = 'saved'; savedAt.value = Date.now() } }
    else { dirty = true; state.value = 'offline' }
  }

  function edit(next: string): void {
    text.value = next.slice(0, LIMITS.textChars)
    dirty = true
    state.value = 'saving'
    clearTimeout(timer)
    timer = setTimeout(() => void send(), 400)
  }

  function onRemote(m: { content: string; rev: number }, el: HTMLTextAreaElement | null): void {
    rev.value = m.rev
    if (dirty) return
    const start = el?.selectionStart ?? 0, end = el?.selectionEnd ?? 0, old = text.value
    text.value = m.content
    savedAt.value = Date.now()
    if (el && document.activeElement === el) nextTick(() => el.setSelectionRange(mapCaret(old, m.content, start), mapCaret(old, m.content, end)))
  }

  async function load(): Promise<void> {
    const r = await api<{ content: string; rev: number }>('/text')
    text.value = r.content; rev.value = r.rev
    state.value = 'saved'; savedAt.value = Date.now()
  }

  function bind(el: () => HTMLTextAreaElement | null): void {
    const sock = spaceSocket()
    const changed = (m: { content: string; rev: number }): void => onRemote(m, el())
    const reconnect = (): void => { if (dirty) void send(); else void load() }
    sock.on('text:changed', changed)
    sock.on('connect', reconnect)
    sock.on('disconnect', () => { if (dirty) state.value = 'offline' })
    onBeforeUnmount(() => { sock.off('text:changed', changed); sock.off('connect', reconnect); clearTimeout(timer) })
    const flush = (): void => { if (dirty) void send() }
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', flush)
    onBeforeUnmount(() => { window.removeEventListener('pagehide', flush); window.removeEventListener('online', flush) })
  }
  return { text, state, savedAt, tooBig, edit, load, bind }
}
