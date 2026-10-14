import { patchApply, patchFromText, patchMake, patchToText } from 'diff-match-patch-es'
import { apply, compose, diffOp, transform, type Op } from './ot'

/**
 * Shared text without lost keystrokes (see ot.ts for the maths).
 *
 * The server owns one text and numbers every change: revision 1, 2, 3... A device sends each of its edits as an
 * operation together with the revision it was made on. The server rewrites the operation to fit everything that happened
 * since (`serverApply`), applies it, and tells the other devices. A device keeps at most ONE operation in flight; what it
 * types meanwhile is collected in `buffer` and sent next. When another device's operation arrives, it is rewritten past
 * the device's own unsent edits before it is shown, so the cursor and the text around it stay where they belong.
 *
 * No sockets, timers or Vue in here: the browser, the server and the tests run the same code.
 */

/** One applied edit, as the server remembers it for a while. `opId` is the sender's id for the edit ('' for older apps). */
export interface HistoryEntry { rev: number; op: Op; opId: string }
export interface DocState { content: string; rev: number }
export type OpResult =
  | { kind: 'ok'; rev: number; op: Op; content: string }
  | { kind: 'dup'; rev: number } // this exact edit already went through (the answer was lost)
  | { kind: 'stale' } // the server no longer has what it needs to fit this edit: the device must resync
  | { kind: 'bad' } // does not fit the text at all
  | { kind: 'toolarge' }

/**
 * Server side, the whole decision for one incoming edit. `history` = recent edits, oldest first (null if there is none).
 * `last` = the last edit this device had applied. The caller does the writing (and must only write if nobody else wrote first).
 */
export function serverHandleOp(cur: DocState, history: HistoryEntry[] | null, req: { opId: string; baseRev: number; op: Op }, last: { opId: string; rev: number } | undefined, max: number): OpResult {
  // rev < 0 marks an edit the server refused (and told the device to resync): a late copy of it must never be applied
  if (last && last.opId === req.opId) return last.rev < 0 ? { kind: 'stale' } : { kind: 'dup', rev: last.rev }
  if (req.baseRev > cur.rev) return { kind: 'stale' }
  const hist = (history ?? []).filter(h => h.rev > req.baseRev)
  const need = cur.rev - req.baseRev
  if (need > 0 && (hist.length !== need || hist[0]!.rev !== req.baseRev + 1)) return { kind: 'stale' }
  try {
    const r = serverApply(cur.content, req.op, hist.map(h => h.op))
    if (r.content.length > max) return { kind: 'toolarge' }
    return { kind: 'ok', rev: cur.rev + 1, op: r.op, content: r.content }
  } catch { return { kind: 'bad' } }
}

/** Server side: everything a device missed since `sinceRev`, or null if the history no longer reaches back that far. */
export function serverSince(cur: DocState, history: HistoryEntry[] | null, sinceRev: number): HistoryEntry[] | null {
  if (sinceRev > cur.rev) return null
  const need = cur.rev - sinceRev
  if (need === 0) return []
  const hist = (history ?? []).filter(h => h.rev > sinceRev)
  return hist.length === need && hist[0]!.rev === sinceRev + 1 ? hist : null
}

/**
 * Server side: turns an operation made on revision `baseRev` into one that fits the text as it is now (`history` = every
 * operation applied after `baseRev`, oldest first). Throws if it does not fit the text.
 */
export function serverApply(content: string, op: Op, history: Op[]): { op: Op; content: string } {
  let fitted = op
  for (const h of history) fitted = transform(fitted, h, 'right')
  return { op: fitted, content: apply(content, fitted) }
}

const FUZZ = { diffTimeout: 0.25 }
/** Last resort when a device missed too much to replay (long offline, server restarted): lay its unsent edit on the new text by matching context. */
function fuzzyMerge(base: string, mine: string, theirs: string): string {
  if (base === mine) return theirs
  const [out] = patchApply(patchFromText(patchToText(patchMake(base, mine, undefined, FUZZ))), theirs, FUZZ) as [string, boolean[]]
  return out
}

export interface OutgoingOp { opId: string; baseRev: number; op: Op }
/** What the server sends: `ack` = your own operation was applied at `rev`; otherwise `op` is another device's operation at `rev`. */
export type ServerMessage = { rev: number; ack: true; opId?: string } | { rev: number; op: Op; ack?: false }

interface InFlight { opId: string; baseRev: number; sent: Op; op: Op }

export class TextClient {
  /** the text on screen */
  doc = ''
  /** the last revision applied */
  rev = 0
  private shadow = '' // the server's text at `rev`
  private flight: InFlight | null = null
  private buffer: Op | null = null
  private held = new Map<number, ServerMessage>()
  private seq = 0

  constructor(private readonly clientId = Math.random().toString(36).slice(2, 10)) {}

  /** There are edits the server has not confirmed yet. */
  get unsent(): boolean { return this.flight !== null || this.buffer !== null }

  /** Start from the server's text (page load, or a reconnect with nothing unsent). */
  load(content: string, rev: number): void {
    this.doc = this.shadow = content
    this.rev = rev
    this.flight = null
    this.buffer = null
    this.held.clear()
  }

  /** The user changed the text on screen. `caret` = the cursor right after the edit (see diffOp). */
  edit(next: string, caret?: number): void {
    const op = diffOp(this.doc, next, caret)
    if (!op.length) return
    this.doc = next
    if (this.flight) this.buffer = this.buffer ? compose(this.buffer, op) : op
    else this.startFlight(op)
  }

  private startFlight(op: Op): void {
    this.flight = { opId: `${this.clientId}.${++this.seq}`, baseRev: this.rev, sent: op, op }
  }

  /** The operation to send now, or null. Until the server answers it returns the very same operation (same opId), so a lost answer can never apply it twice. */
  outgoing(): OutgoingOp | null {
    return this.flight ? { opId: this.flight.opId, baseRev: this.flight.baseRev, op: this.flight.sent } : null
  }

  /** Feeds in what the server sent. Returns the other devices' changes as they apply to the text on screen, for moving the cursor. */
  receive(m: ServerMessage): Op[] {
    if (m.rev <= this.rev) return []
    this.held.set(m.rev, m)
    return this.drain()
  }

  /** Applies what the server remembers from after `this.rev` (after a reconnect or a gap). The device's own edit shows up here as its answer. */
  catchUp(entries: HistoryEntry[]): Op[] {
    const applied: Op[] = []
    for (const e of entries) {
      if (e.rev <= this.rev) continue
      const mine = this.flight !== null && e.opId !== '' && e.opId === this.flight.opId
      applied.push(...this.receive(mine ? { rev: e.rev, ack: true, opId: e.opId } : { rev: e.rev, op: e.op }))
    }
    return applied
  }

  /** True when a message from the server is missing (a later revision arrived first). */
  get gap(): boolean { return this.held.size > 0 }

  private drain(): Op[] {
    const applied: Op[] = []
    for (let m = this.held.get(this.rev + 1); m; m = this.held.get(this.rev + 1)) {
      this.held.delete(this.rev + 1)
      if (m.ack === true) this.acknowledged(m.rev, m.opId)
      else applied.push(this.remote(m.rev, m.op))
    }
    for (const r of this.held.keys()) if (r <= this.rev) this.held.delete(r)
    return applied
  }

  private acknowledged(rev: number, opId: string | undefined): void {
    const f = this.flight
    if (opId !== undefined && f?.opId !== opId) return // a late answer for an edit this device has since given up on
    this.rev = rev
    if (!f) return // an answer for something we no longer track
    this.shadow = apply(this.shadow, f.op)
    this.flight = null
    if (this.buffer) { const next = this.buffer; this.buffer = null; this.startFlight(next) }
  }

  private remote(rev: number, op: Op): Op {
    let shown = op
    const f = this.flight
    if (f) { const t = transform(shown, f.op, 'left'); f.op = transform(f.op, shown, 'right'); shown = t }
    const b = this.buffer
    if (b) { const t = transform(shown, b, 'left'); this.buffer = transform(b, shown, 'right'); shown = t }
    this.shadow = apply(this.shadow, op)
    this.doc = apply(this.doc, shown)
    this.rev = rev
    return shown
  }

  /**
   * The server says this device is too far behind to replay (or has lost its history). Take the server's text and lay the
   * unsent edits on top by matching context. `applied` = the operation in flight had already gone through.
   * Returns the changes to the on-screen text, in order, for moving the cursor.
   */
  resync(content: string, rev: number, applied: boolean, max: number): Op[] {
    const before = this.doc
    const intendedBase = applied && this.flight ? apply(this.shadow, this.flight.op) : this.shadow
    const merged = fuzzyMerge(intendedBase, before, content).slice(0, max)
    this.doc = merged
    this.shadow = content
    this.rev = rev
    this.flight = null
    this.buffer = null
    const mine = diffOp(content, merged)
    if (mine.length) this.startFlight(mine)
    return [diffOp(before, merged), ...this.drain()].filter(o => o.length > 0)
  }
}
