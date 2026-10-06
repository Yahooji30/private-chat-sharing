import { reactive } from 'vue'

export const ui = reactive({
  toasts: [] as { id: number; kind: 'ok' | 'err'; text: string }[],
  dialog: null as null | { title: string; text: string; danger: boolean; resolve: (v: boolean) => void },
})
let seq = 0
export function toast(kind: 'ok' | 'err', text: string): void {
  const id = ++seq
  ui.toasts.push({ id, kind, text })
  setTimeout(() => { ui.toasts = ui.toasts.filter(t => t.id !== id) }, 3500)
}
export const ok = (t: string): void => toast('ok', t)
export const fail = (e: unknown): void => toast('err', e instanceof Error ? e.message : 'Something went wrong')
export const confirmDialog = (title: string, text: string, danger = true): Promise<boolean> => new Promise(resolve => { ui.dialog = { title, text, danger, resolve } })
export const fmtDate = (ms: number | null): string => (ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-')
export const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`)
