/** In-app confirmation dialog (replaces the browser's confirm()). `await confirmDialog(...)` resolves true or false. */
export interface ConfirmState { title: string; text: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }
export const useConfirmState = () => useState<ConfirmState | null>('confirm-dialog', () => null)
export function confirmDialog(title: string, text: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  const state = useConfirmState()
  return new Promise(resolve => { state.value = { title, text, confirmLabel: opts.confirmLabel ?? 'Confirm', danger: opts.danger ?? true, resolve } })
}
