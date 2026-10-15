export interface Toast { id: number; kind: 'ok' | 'warn' | 'err'; text: string }
const toasts = ref<Toast[]>([])
let seq = 0
// errors stay longest so they can be read
const TIME = { ok: 3000, warn: 5000, err: 6000 }

export function useToast() {
  const dismiss = (id: number): void => { toasts.value = toasts.value.filter(t => t.id !== id) }
  const push = (kind: Toast['kind'], text: string): void => {
    const same = toasts.value.find(t => t.kind === kind && t.text === text)
    if (same) dismiss(same.id) // the same message again replaces the old one instead of stacking
    const id = ++seq
    toasts.value = [...toasts.value.slice(-2), { id, kind, text }]
    setTimeout(() => dismiss(id), TIME[kind])
  }
  return { toasts, dismiss, ok: (t: string) => push('ok', t), warn: (t: string) => push('warn', t), err: (t: string) => push('err', t) }
}
