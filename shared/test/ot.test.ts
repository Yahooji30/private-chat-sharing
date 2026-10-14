import { describe, expect, it } from 'vitest'
import { apply, compose, diffOp, inputLength, isOp, normalize, transform, transformPos, type Op } from '../src/ot'

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const ALPHABET = Array.from('ab cd\n😀é') // whole characters, so an emoji is never split into broken halves
const randText = (r: () => number, max: number): string => { let s = ''; for (let n = Math.floor(r() * max); n > 0; n--) { const c = ALPHABET[Math.floor(r() * ALPHABET.length)]!; s += c } return s }
/** a random edit of `doc`: several scattered inserts and deletes */
function randOp(r: () => number, doc: string): Op {
  const op: Op = []
  let pos = 0
  while (pos < doc.length && r() < 0.9) {
    const keep = Math.floor(r() * 6)
    const k = Math.min(keep, doc.length - pos)
    if (k) op.push(k)
    pos += k
    if (r() < 0.5) op.push(randText(r, 4) || 'x')
    else if (pos < doc.length) { const d = Math.min(1 + Math.floor(r() * 4), doc.length - pos); op.push(-d); pos += d }
  }
  if (r() < 0.4) op.push(randText(r, 3) || 'y')
  return normalize(op)
}

describe('ops', () => {
  it('apply, normalize and the length an op reads', () => {
    expect(apply('hello world', [6, -5, 'there'])).toBe('hello there')
    expect(apply('abc', [])).toBe('abc')
    expect(apply('abc', [1, 'XY', 2])).toBe('aXYbc')
    expect(normalize([2, 3, 'a', 'b', -1, -2, 4])).toEqual([5, 'ab', -3])
    expect(normalize([0, 'x', 5])).toEqual(['x'])
    expect(inputLength([2, 'xyz', -3, 4])).toBe(9)
    expect(() => apply('abc', [4])).toThrow()
    expect(() => apply('abc', [-4])).toThrow()
  })

  it('transform puts two edits of the same text in order', () => {
    const doc = 'one two three'
    const a: Op = [4, 'ONE-AND-A-HALF '] // insert before "two"
    const b: Op = [4, -4] // delete "two "
    const viaA = apply(apply(doc, a), transform(b, a, 'right'))
    const viaB = apply(apply(doc, b), transform(a, b, 'left'))
    expect(viaA).toBe(viaB)
    expect(viaA).toBe('one ONE-AND-A-HALF three')
  })

  it('two inserts at the same spot keep both, in a fixed order', () => {
    const doc = 'ab'
    const a: Op = [1, 'X']
    const b: Op = [1, 'Y']
    expect(apply(apply(doc, a), transform(b, a, 'right'))).toBe('aXYb') // a went first
    expect(apply(apply(doc, b), transform(a, b, 'left'))).toBe('aXYb') // same result seen from the other side
  })

  it('converges: for any two edits, either order gives the same text (20,000 random cases)', () => {
    const r = rng(7)
    for (let i = 0; i < 20_000; i++) {
      const doc = randText(r, 40)
      const a = randOp(r, doc), b = randOp(r, doc)
      const x = apply(apply(doc, a), transform(b, a, 'right'))
      const y = apply(apply(doc, b), transform(a, b, 'left'))
      if (x !== y) throw new Error(`diverged on ${JSON.stringify({ doc, a, b, x, y })}`)
    }
  })

  it('compose does a then b (20,000 random cases)', () => {
    const r = rng(11)
    for (let i = 0; i < 20_000; i++) {
      const doc = randText(r, 40)
      const a = randOp(r, doc)
      const mid = apply(doc, a)
      const b = randOp(r, mid)
      const c = compose(a, b)
      if (apply(doc, c) !== apply(mid, b)) throw new Error(`compose wrong on ${JSON.stringify({ doc, a, b, c })}`)
    }
  })

  it('moves a cursor with the text around it', () => {
    expect(transformPos(3, [0, 'ZZZ '].filter(x => x !== 0))).toBe(7) // text typed before the cursor
    expect(transformPos(3, [5, 'tail'])).toBe(3) // after it
    expect(transformPos(5, [5, 'x'])).toBe(5) // exactly at the cursor: stays in front
    expect(transformPos(9, [2, -4])).toBe(5) // text before the cursor deleted
    expect(transformPos(4, [2, -6])).toBe(2) // text under the cursor deleted
    expect(transformPos(0, ['abc'])).toBe(0)
    expect(transformPos(2, [])).toBe(2)
  })

  it('diffOp describes any change as one edit, and never splits an emoji', () => {
    const r = rng(5)
    for (let i = 0; i < 5_000; i++) {
      const a = randText(r, 30), b = randText(r, 30)
      const op = diffOp(a, b)
      expect(apply(a, op)).toBe(b)
      for (const c of op) if (typeof c === 'string') { expect(c.charCodeAt(0) >= 0xdc00 && c.charCodeAt(0) <= 0xdfff).toBe(false) }
    }
    expect(diffOp('same', 'same')).toEqual([])
    expect(diffOp('a😀b', 'a😁b')).toEqual([1, '😁', -2])
  })

  it('isOp accepts real edits and rejects hostile input', () => {
    expect(isOp([2, 'x', -3], 100)).toBe(true)
    expect(isOp([], 100)).toBe(true)
    for (const bad of [null, 'x', {}, [0], [1.5], [''], [NaN], [Infinity], [null], [{}], [1000], ['x'.repeat(101)], new Array(5000).fill(1)]) expect(isOp(bad, 100), JSON.stringify(bad)?.slice(0, 40)).toBe(false)
  })
})
