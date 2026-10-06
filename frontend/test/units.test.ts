import { describe, expect, it } from 'vitest'
import { decryptMsg, deriveKeys, encryptMsg, randomSalt, strength } from '../app/lib/crypto/chat'
import { mapCaret } from '../app/utils/caret'
import { findUrls, fmtAgo, fmtBytes, fmtClock, hrefOf } from '../app/utils/format'

describe('chat crypto', () => {
  it('derives stable keys per password+salt and encrypts with room binding', async () => {
    const salt = randomSalt()
    const a = await deriveKeys('correct horse', salt, 1000), b = await deriveKeys('correct horse', salt, 1000), c = await deriveKeys('other pass', salt, 1000)
    expect(a.authKey).toBe(b.authKey)
    expect(a.authKey).not.toBe(c.authKey)
    expect(a.encKey.extractable).toBe(false)
    const m = await encryptMsg(a.encKey, 'hello 👋', 'ROOM1')
    expect(m.ct).not.toContain('hello')
    expect(await decryptMsg(b.encKey, m, 'ROOM1')).toBe('hello 👋')
    expect(await decryptMsg(c.encKey, m, 'ROOM1')).toBeNull()
    expect(await decryptMsg(a.encKey, m, 'ROOM2')).toBeNull()
    expect((await encryptMsg(a.encKey, 'hello 👋', 'ROOM1')).iv).not.toBe(m.iv)
  })
  it('auth key does not reveal the encryption key and strength scores sanely', async () => {
    const k = await deriveKeys('pw-123456', randomSalt(), 1000)
    expect(k.authKey).toHaveLength(44)
    expect(strength('abc')).toBe(0); expect(strength('Abcdefgh1!xyz')).toBe(4)
  })
})

describe('caret mapping', () => {
  it('keeps the caret stable when remote text is inserted before or after it', () => {
    expect(mapCaret('hello world', 'XX hello world', 11)).toBe(14)
    expect(mapCaret('hello world', 'hello world!!', 5)).toBe(5)
    expect(mapCaret('abc', '', 2)).toBe(0)
  })
})

describe('format helpers', () => {
  it('finds, dedupes and cleans urls', () => {
    expect(findUrls('see http://a.com, and https://b.org/x?y=1). also www.c.io! http://a.com')).toEqual(['http://a.com', 'https://b.org/x?y=1', 'www.c.io'])
    expect(findUrls('no links here')).toEqual([])
    expect(findUrls('test.com\n\nhttp://test.com\nhttps://www/test.com')).toEqual(['test.com', 'http://test.com'])
    expect(findUrls('mail me@site.com, file.txt, index.js, e.g. v1.2.3, 3.14, https://a.dev/p?q=1#x')).toEqual(['https://a.dev/p?q=1#x'])
    expect(findUrls('http://localhost:3000/x 192.168.1.5:8080 (https://en.wikipedia.org/wiki/Foo_(bar)) "docs.github.com/en"')).toEqual(['http://localhost:3000/x', '192.168.1.5:8080', 'https://en.wikipedia.org/wiki/Foo_(bar)', 'docs.github.com/en'])
    expect(findUrls('HTTP://A.com/ http://a.com')).toEqual(['HTTP://A.com/'])
    expect(hrefOf('www.c.io')).toBe('https://www.c.io'); expect(hrefOf('http://a.com')).toBe('http://a.com')
  })
  it('formats sizes, clocks and ages', () => {
    expect(fmtBytes(0)).toBe('0 B'); expect(fmtBytes(1536)).toBe('1.5 KB'); expect(fmtBytes(5 * 1024 ** 3)).toBe('5.0 GB')
    expect(fmtClock(249_000)).toBe('4m 09s')
    expect(fmtAgo(1000, 1500)).toBe('just now'); expect(fmtAgo(0, 120_000)).toBe('2 minutes ago')
  })
})
