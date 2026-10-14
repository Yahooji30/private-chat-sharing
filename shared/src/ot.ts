/**
 * Operational transformation for plain text: the maths that lets several people type in the same text at the same time
 * without anybody's keystrokes being lost, doubled or put in the wrong place.
 *
 * An operation (`Op`) describes one edit of a text as a list of steps, read left to right:
 *   a positive number   keep that many characters
 *   a negative number   delete that many characters
 *   a string            insert it here
 * Characters after the last step are kept, so `[3, 'x']` means "keep 3, insert x, keep the rest".
 *
 * Two edits made at the same time to the same text can be put in order with `transform`: the second one is rewritten so it
 * still means the same thing after the first has happened. Every device and the server apply edits in the same order, so
 * everyone ends with the same text.
 */

export type Comp = number | string
export type Op = Comp[]

const isRetain = (c: Comp): c is number => typeof c === 'number' && c > 0
const isDelete = (c: Comp): c is number => typeof c === 'number' && c < 0

/** Canonical form: neighbours merged, inserts before deletes, no steps of zero, no trailing "keep". */
export function normalize(op: Op): Op {
  const out: Op = []
  let ins = ''
  let del = 0
  const flush = (): void => {
    if (ins) out.push(ins)
    if (del) out.push(-del)
    ins = ''
    del = 0
  }
  for (const c of op) {
    if (typeof c === 'string') ins += c
    else if (c < 0) del -= c
    else if (c > 0) {
      flush()
      const last = out[out.length - 1]
      if (typeof last === 'number' && last > 0) out[out.length - 1] = last + c
      else out.push(c)
    }
  }
  flush()
  while (out.length && isRetain(out[out.length - 1]!)) out.pop()
  return out
}

/** How many characters of the old text the op reads (kept and deleted). */
export function inputLength(op: Op): number {
  let n = 0
  for (const c of op) if (typeof c === 'number') n += Math.abs(c)
  return n
}

/** Applies `op` to `doc`. Throws if the op reaches past the end of the text. */
export function apply(doc: string, op: Op): string {
  let pos = 0
  let out = ''
  for (const c of op) {
    if (typeof c === 'string') out += c
    else if (c > 0) {
      if (pos + c > doc.length) throw new RangeError('op is longer than the text')
      out += doc.slice(pos, pos + c)
      pos += c
    } else {
      if (pos - c > doc.length) throw new RangeError('op is longer than the text')
      pos -= c
    }
  }
  return out + doc.slice(pos)
}

/** Steps through an op in pieces of any size. Past the end it reads as "keep everything". */
class Reader {
  private i = 0
  private used = 0
  constructor(private readonly op: Op) {}
  get done(): boolean { return this.i >= this.op.length }
  private total(): number { const c = this.op[this.i]; return c === undefined ? Infinity : typeof c === 'string' ? c.length : Math.abs(c) }
  kind(): 'insert' | 'delete' | 'keep' { const c = this.op[this.i]; return c === undefined ? 'keep' : typeof c === 'string' ? 'insert' : c < 0 ? 'delete' : 'keep' }
  /** length left in the current step */
  len(): number { return this.total() - this.used }
  /** takes up to `n` of the current step: a string for an insert, otherwise +n (keep) or -n (delete) */
  take(n: number): Comp {
    const c = this.op[this.i]!
    const k = Math.min(n, this.len())
    const piece: Comp = typeof c === 'string' ? c.slice(this.used, this.used + k) : c < 0 ? -k : k
    this.used += k
    if (this.used >= this.total()) { this.i++; this.used = 0 }
    return piece
  }
}

/**
 * Rewrites `a` so it can be applied after `b`, when both were made to the same text. When both insert at the very same
 * spot, `side` decides the order: 'left' puts a's text first, 'right' puts it after b's. The server uses 'right' for the
 * edit that arrives later, and every device uses 'left' for edits that came from the server.
 */
export function transform(a: Op, b: Op, side: 'left' | 'right'): Op {
  const out: Op = []
  const A = new Reader(a)
  const B = new Reader(b)
  while (!A.done || !B.done) {
    const ka = A.done ? 'keep' : A.kind()
    const kb = B.done ? 'keep' : B.kind()
    if (ka === 'insert' && (side === 'left' || kb !== 'insert')) { out.push(A.take(Infinity)); continue }
    if (kb === 'insert') { out.push((B.take(Infinity) as string).length); continue }
    const n = Math.min(A.done ? Infinity : A.len(), B.done ? Infinity : B.len())
    const ta = A.done ? n : (A.take(n) as number)
    const tb = B.done ? n : (B.take(n) as number)
    if (ta > 0) { if (tb > 0) out.push(n) } // kept by a: kept unless b deleted it
    else if (tb > 0) out.push(-n) // deleted by a, and b left it alone
    // deleted by both: already gone
  }
  return normalize(out)
}

/** One op that does `a` and then `b` (b was made to the text that results from a). */
export function compose(a: Op, b: Op): Op {
  const out: Op = []
  const A = new Reader(a)
  const B = new Reader(b)
  while (!A.done || !B.done) {
    if (!A.done && A.kind() === 'delete') { out.push(A.take(Infinity)); continue }
    if (!B.done && B.kind() === 'insert') { out.push(B.take(Infinity)); continue }
    const n = Math.min(A.done ? Infinity : A.len(), B.done ? Infinity : B.len())
    const ta = A.done ? n : A.take(n)
    const tb = B.done ? n : (B.take(n) as number)
    if (typeof ta === 'string') { if (tb > 0) out.push(ta) } // typed by a: kept, or typed and then removed by b
    else out.push(tb > 0 ? n : -n)
  }
  return normalize(out)
}

/** Where a cursor at `pos` ends up after `op`. A cursor at the exact spot of an insert stays in front of it. */
export function transformPos(pos: number, op: Op): number {
  let at = 0 // how much of the old text has been passed
  let out = pos
  for (const c of op) {
    if (at >= pos) break // everything from here on is at or after the cursor
    if (typeof c === 'string') out += c.length
    else if (c > 0) at += c
    else { out -= Math.min(-c, pos - at); at -= c }
  }
  return out
}

const high = (code: number): boolean => code >= 0xd800 && code <= 0xdbff
const low = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff

/**
 * The op that turns `from` into `to`: keep the common start and end, replace what is between. Never splits an emoji.
 * `caret` = where the cursor is in `to` right after the edit. Typing, pasting, backspace and delete all leave it at the end of the
 * change, which settles an ambiguity: typing "a" next to another "a" could be described as an insert on either side of it.
 */
export function diffOp(from: string, to: string, caret?: number): Op {
  if (from === to) return []
  const min = Math.min(from.length, to.length)
  const sMax = caret === undefined ? min : Math.max(0, Math.min(min, to.length - caret))
  let s = 0
  if (caret !== undefined) while (s < sMax && from.charCodeAt(from.length - 1 - s) === to.charCodeAt(to.length - 1 - s)) s++
  let p = 0
  while (p < min - s && from.charCodeAt(p) === to.charCodeAt(p)) p++
  if (p > 0 && high(from.charCodeAt(p - 1))) p--
  if (caret === undefined) {
    while (s < min - p && from.charCodeAt(from.length - 1 - s) === to.charCodeAt(to.length - 1 - s)) s++
  }
  if (s > 0 && low(from.charCodeAt(from.length - s))) s--
  const removed = from.length - p - s
  const added = to.slice(p, to.length - s)
  return normalize([p, -removed, added])
}

/** True for a well-formed op that a stranger could have sent (right types, no zeros, sane sizes). */
export function isOp(v: unknown, maxChars: number): v is Op {
  if (!Array.isArray(v) || v.length > 4000) return false
  let chars = 0
  for (const c of v) {
    if (typeof c === 'string') { if (!c) return false; chars += c.length }
    else if (!Number.isInteger(c) || c === 0 || Math.abs(c) > maxChars) return false
  }
  return chars <= maxChars
}
