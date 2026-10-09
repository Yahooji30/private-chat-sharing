import { DEFAULT_CHAT_SHARE_MESSAGE, chatShareText, seoInputSchema, type SeoEntry } from '@sync/shared'
import { describe, expect, it } from 'vitest'
import { applySeo } from '../server/utils/seo'

const none: SeoEntry = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '', canonical: '', noindex: false }
const HEAD = '<meta charset="utf-8"><title>Sync</title><meta name="description" content="old text"><link rel="icon" href="/icon.svg">'

describe('applySeo (admin SEO tags in the first HTML)', () => {
  it('replaces the title and description instead of duplicating them', () => {
    const out = applySeo(HEAD, { ...none, title: 'New title', description: 'New description' }, '')
    expect(out.match(/<title>/g)).toHaveLength(1)
    expect(out).toContain('<title>New title</title>')
    expect(out.match(/name="description"/g)).toHaveLength(1)
    expect(out).toContain('<meta name="description" content="New description">')
    expect(out).not.toContain('old text')
    expect(out).toContain('<link rel="icon" href="/icon.svg">')
  })

  it('adds social tags, falling back to the page title and description', () => {
    const out = applySeo(HEAD, { ...none, title: 'T', description: 'D', ogImage: '/media/x.webp' }, 'https://blog.example.com')
    expect(out).toContain('<meta property="og:title" content="T">')
    expect(out).toContain('<meta property="og:description" content="D">')
    expect(out).toContain('<meta property="og:image" content="https://blog.example.com/media/x.webp">')
    expect(out).toContain('content="summary_large_image"')
    const own = applySeo(HEAD, { ...none, title: 'T', ogTitle: 'Share me' }, '')
    expect(own).toContain('<meta property="og:title" content="Share me">')
  })

  it('skips the image when the blog address is not configured', () => {
    expect(applySeo(HEAD, { ...none, title: 'T', ogImage: '/media/x.webp' }, '')).not.toContain('og:image')
  })

  it('adds robots, keywords and canonical when set, and nothing when empty', () => {
    const out = applySeo(HEAD, { ...none, noindex: true, keywords: 'a, b', canonical: 'https://example.com/' }, '')
    expect(out).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(out).toContain('<meta name="keywords" content="a, b">')
    expect(out).toContain('<link rel="canonical" href="https://example.com/">')
    expect(applySeo(HEAD, none, '')).toBe(HEAD)
  })

  it('escapes whatever the admin typed so it cannot break out of the tag', () => {
    const out = applySeo(HEAD, { ...none, title: '</title><script>alert(1)</script>', description: '"><img src=x onerror=alert(1)>' }, '')
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;script&gt;')
  })
})

describe('chat invite message', () => {
  const link = 'https://example.com/c/ABCD1234'
  it('is the client wording plus the room link on its own line', () => {
    expect(DEFAULT_CHAT_SHARE_MESSAGE).toBe('I have sent you a secret message. Please click on this link, use the password ** and read the message.')
    expect(chatShareText(undefined, link)).toBe(`${DEFAULT_CHAT_SHARE_MESSAGE}\n\n${link}`)
    expect(chatShareText('   ', link)).toBe(`${DEFAULT_CHAT_SHARE_MESSAGE}\n\n${link}`)
  })
  it('honours an admin template, with {link} placed anywhere or appended', () => {
    expect(chatShareText('Secret waiting: {link} (ask me for the password)', link)).toBe(`Secret waiting: ${link} (ask me for the password)`)
    expect(chatShareText('Open {link} then {link}', link)).toBe(`Open ${link} then ${link}`)
    expect(chatShareText('Just read it', link)).toBe(`Just read it\n\n${link}`)
  })
})

describe('seo input rules', () => {
  it('accepts an empty form and rejects non-http canonicals and over-long titles', () => {
    expect(seoInputSchema.safeParse({}).success).toBe(true)
    expect(seoInputSchema.safeParse({ canonical: 'javascript:alert(1)' }).success).toBe(false)
    expect(seoInputSchema.safeParse({ canonical: 'https://example.com/x' }).success).toBe(true)
    expect(seoInputSchema.safeParse({ title: 'x'.repeat(121) }).success).toBe(false)
  })
})
