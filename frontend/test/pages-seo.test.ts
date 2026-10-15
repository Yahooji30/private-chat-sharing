import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { SeoEntry } from '@sync/shared'
import { describe, expect, it } from 'vitest'
import { applySeo, cleanPath, isKnownRoute, pageInfo, robotsTxt, sitemapIndexXml, sitemapXml, wantsPage } from '../server/utils/seo'

const none: SeoEntry = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '', canonical: '', noindex: false }
const HEAD = '<meta charset="utf-8"><meta name="description" content="generic"><link rel="icon" href="/i.png">'
const fallback = { title: 'Home page', description: 'About the home page', url: 'https://jodbox.com/', canonical: 'https://jodbox.com/', image: 'https://jodbox.com/og-image.jpg' }

describe('first HTML of an app page without anything from the admin', () => {
  const out = applySeo(HEAD, undefined, 'https://blog.jodbox.com', fallback)
  it('has a title, a description and the tags link previews need', () => {
    expect(out).toContain('<title>Home page</title>')
    expect(out).toContain('<meta name="description" content="About the home page">')
    expect(out.match(/name="description"/g)).toHaveLength(1)
    expect(out).toContain('<meta property="og:title" content="Home page">')
    expect(out).toContain('<meta property="og:description" content="About the home page">')
    expect(out).toContain('<meta property="og:image" content="https://jodbox.com/og-image.jpg">')
    expect(out).toContain('<meta property="og:url" content="https://jodbox.com/">')
    expect(out).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(out).toContain('<link rel="canonical" href="https://jodbox.com/">')
    expect(out).not.toContain('noindex')
  })
  it('lets the admin override any of it and keeps the rest', () => {
    const o = applySeo(HEAD, { ...none, title: 'Admin title', canonical: 'https://x.test/' }, '', fallback)
    expect(o).toContain('<title>Admin title</title>')
    expect(o).toContain('<meta name="description" content="About the home page">')
    expect(o).toContain('<link rel="canonical" href="https://x.test/">')
    expect(o).not.toContain('https://jodbox.com/"></')
  })
  it('turns a hidden page into noindex and prefers the admin picture', () => {
    const o = applySeo(HEAD, { ...none, noindex: true, ogImage: '/media/p.webp' }, 'https://blog.jodbox.com', fallback)
    expect(o).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(o).toContain('content="https://blog.jodbox.com/media/p.webp"')
    expect(o).not.toContain('og-image.jpg')
  })
  it('escapes everything it writes', () => {
    const o = applySeo(HEAD, undefined, '', { ...fallback, title: '</title><script>x</script>', description: '"><b>' })
    expect(o).not.toContain('<script>')
    expect(o).not.toContain('<b>')
  })
})

describe('which address is which page', () => {
  it('knows the pages search engines care about, and sends the blog ones to the blog site', () => {
    expect(pageInfo('/', 'Jodbox')?.key).toBe('home')
    expect(pageInfo('/chat', 'Jodbox')?.key).toBe('chat')
    expect(pageInfo('/faq', 'Jodbox')).toMatchObject({ key: 'faq', blogPath: '/faq', title: 'FAQ | Jodbox' })
    expect(pageInfo('/blog', 'Jodbox')).toMatchObject({ key: 'blog', blogPath: '/' })
    expect(pageInfo('/home', 'Jodbox')).toBeNull()
    expect(pageInfo('/c/ABCD1234', 'Jodbox')).toBeNull() // private rooms get nothing
  })
  it('cleans an address', () => {
    expect(cleanPath('/faq/?a=1#x')).toBe('/faq')
    expect(cleanPath('/')).toBe('/')
    expect(cleanPath('/?share=1')).toBe('/')
    expect(cleanPath('')).toBe('/')
  })
})

describe('404 for addresses the app does not have', () => {
  /** every page file in app/pages as an address, with a made-up value for each [param] */
  function pageAddresses(): string[] {
    const root = join(__dirname, '..', 'app', 'pages')
    const out: string[] = []
    const walk = (dir: string): void => {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f)
        if (statSync(full).isDirectory()) { walk(full); continue }
        if (!f.endsWith('.vue')) continue
        const parts = relative(root, full).replace(/\\/g, '/').replace(/\.vue$/, '').split('/').filter(p => p !== 'index')
        out.push('/' + parts.map(p => (p.startsWith('[') ? 'x1' : p)).join('/'))
      }
    }
    walk(root)
    return out
  }

  it('every page in app/pages is a known address (add new pages to ROUTES in server/utils/seo.ts)', () => {
    const pages = pageAddresses()
    expect(pages.length).toBeGreaterThanOrEqual(10)
    for (const p of pages) expect(isKnownRoute(p === '' ? '/' : p), p).toBe(true)
  })
  it('refuses unknown and malformed addresses', () => {
    for (const p of ['/nope', '/admin', '/c', '/c/a/b', '/blog/a/b/c', '/faq/extra', '/settings']) expect(isKnownRoute(p), p).toBe(false)
  })
  it('only answers real page requests with 404, never files', () => {
    expect(wantsPage('/nope', 'text/html,application/xhtml+xml')).toBe(true)
    expect(wantsPage('/nope', '*/*')).toBe(false)
    expect(wantsPage('/_nuxt/app.js', 'text/html')).toBe(false)
    expect(wantsPage('/favicon.ico', 'text/html')).toBe(false)
    expect(wantsPage('/some.page', 'text/html')).toBe(false)
  })
})

describe('robots.txt and sitemap.xml of the app', () => {
  it('robots points search engines at both sitemaps and hides private places', () => {
    const r = robotsTxt('https://jodbox.com', 'https://blog.jodbox.com')
    expect(r).toContain('Sitemap: https://jodbox.com/sitemap-index.xml')
    expect(r).toContain('Sitemap: https://jodbox.com/sitemap.xml')
    expect(r).toContain('Sitemap: https://blog.jodbox.com/sitemap.xml')
    for (const d of ['/api/', '/c/', '/link']) expect(r).toContain(`Disallow: ${d}`)
    expect(robotsTxt('https://jodbox.com', '')).not.toContain('blog')
  })
  it('the sitemap index points at the app sitemap and the blog sitemap', () => {
    const x = sitemapIndexXml('https://jodbox.com', 'https://blog.jodbox.com')
    expect(x).toContain('<sitemapindex')
    expect(x).toContain('<loc>https://jodbox.com/sitemap.xml</loc>')
    expect(x).toContain('<loc>https://blog.jodbox.com/sitemap.xml</loc>')
    expect(sitemapIndexXml('https://jodbox.com', '')).not.toContain('blog')
  })
  it('the sitemap lists the app pages, minus any the admin hid, and only on its own host', () => {
    expect(sitemapXml('https://jodbox.com', {})).toBe('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://jodbox.com/</loc></url><url><loc>https://jodbox.com/chat</loc></url></urlset>')
    const hidden = sitemapXml('https://jodbox.com', { chat: { ...none, noindex: true } })
    expect(hidden).toContain('<loc>https://jodbox.com/</loc>')
    expect(hidden).not.toContain('/chat')
  })
})
