export interface Toast { id: number; kind: 'ok' | 'warn' | 'err'; text: string }
const toasts = ref<Toast[]>([])
let seq = 0

export function useToast() {
  const push = (kind: Toast['kind'], text: string, ms = 3200): void => {
    const id = ++seq
    toasts.value = [...toasts.value.slice(-2), { id, kind, text }]
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, ms)
  }
  return { toasts, ok: (t: string) => push('ok', t), warn: (t: string) => push('warn', t), err: (t: string) => push('err', t) }
}
