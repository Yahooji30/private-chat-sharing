/** Applies a remote change while keeping the caret stable (common prefix/suffix mapping). */
export function mapCaret(oldText: string, newText: string, pos: number): number {
  let p = 0
  const max = Math.min(oldText.length, newText.length)
  while (p < max && oldText[p] === newText[p]) p++
  if (pos <= p) return pos
  let s = 0
  while (s < max - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++
  if (pos >= oldText.length - s) return newText.length - (oldText.length - pos)
  return Math.min(pos, newText.length)
}
