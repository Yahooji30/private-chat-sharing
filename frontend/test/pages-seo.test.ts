import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { SeoEntry } from '@sync/shared'
import { describe, expect, it } from 'vitest'
import { blogSitemapEntries, blogSitemapNames } from '@sync/shared'
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
    expect(pageInfo('/faq', 'Jodbox')).toMatchObject({ key: 'faq', title: 'FAQ | Jodbox' })
    expect(pageInfo('/faq', 'Jodbox')?.blogPath).toBeUndefined() // the blog site has no FAQ page: this one is its own canonical
    expect(pageInfo('/features', 'Jodbox')?.blogPath).toBeUndefined()
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

describe('the blog served under /blog of the same site', () => {
  it('puts the picture at the site root, not under /blog', () => {
    const o = applySeo(HEAD, { ...none, ogImage: '/media/p.webp' }, 'https://jodbox.com/blog', fallback)
    expect(o).toContain('<meta property="og:image" content="https://jodbox.com/media/p.webp">')
    expect(applySeo(HEAD, { ...none, ogImage: '/media/p.webp' }, 'https://blog.jodbox.com', fallback)).toContain('content="https://blog.jodbox.com/media/p.webp"') // own address: as before
  })
  it('the sitemap index gives each blog file its date, and lists no empty file', () => {
    const x = sitemapIndexXml('https://jodbox.com', 'https://jodbox.com/blog', [{ name: 'articles-1', lastmod: '2026-02-02T00:00:00.000Z' }, { name: 'taxonomy-1' }])
    expect(x).toContain('<loc>https://jodbox.com/blog/sitemaps/articles-1.xml</loc><lastmod>2026-02-02T00:00:00.000Z</lastmod>')
    expect(x).toContain('<loc>https://jodbox.com/blog/sitemaps/taxonomy-1.xml</loc></sitemap>')
    expect(sitemapIndexXml('https://jodbox.com', 'https://jodbox.com/blog', blogSitemapEntries({ articles: 0, taxonomy: 0 }))).not.toContain('/blog/')
  })
  it('sitemap index names the blog files under /blog', () => {
    const x = sitemapIndexXml('https://jodbox.com', 'https://jodbox.com/blog', ['articles-1', 'taxonomy-1'])
    expect(x).toContain('<loc>https://jodbox.com/sitemap-pages.xml</loc>')
    expect(x).toContain('<loc>https://jodbox.com/blog/sitemaps/articles-1.xml</loc>')
    expect(robotsTxt('https://jodbox.com', 'https://jodbox.com/blog')).toBe(['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /c/', 'Disallow: /link', 'Disallow: /settings', '', 'Sitemap: https://jodbox.com/sitemap.xml', ''].join('\n'))
  })
})

describe('robots.txt and sitemap.xml of the app', () => {
  it('robots points search engines at both sitemaps and hides private places', () => {
    const r = robotsTxt('https://jodbox.com', 'https://blog.jodbox.com')
    expect(r).toContain('Sitemap: https://jodbox.com/sitemap.xml') // the one sitemap; it lists the others
    expect(r.match(/Sitemap:/g)).toHaveLength(1)
    for (const d of ['/api/', '/c/', '/link']) expect(r).toContain(`Disallow: ${d}`)
    expect(robotsTxt('https://jodbox.com', '')).not.toContain('blog')
  })
  it('the sitemap index names the app sitemap and every file of the blog sitemap', () => {
    const x = sitemapIndexXml('https://jodbox.com', 'https://blog.jodbox.com', blogSitemapNames({ articles: 12_000, taxonomy: 40 }))
    expect(x).toContain('<sitemapindex')
    expect(x).toContain('<loc>https://jodbox.com/sitemap-pages.xml</loc>')
    expect(x).not.toContain('<loc>https://jodbox.com/sitemap.xml</loc>')
    for (const n of ['articles-1', 'articles-2', 'articles-3', 'taxonomy-1']) expect(x).toContain(`<loc>https://blog.jodbox.com/sitemaps/${n}.xml</loc>`)
    expect(x).not.toContain('articles-4')
    expect(x).not.toContain('sitemaps/pages.xml')
    expect(sitemapIndexXml('https://jodbox.com', '', [])).not.toContain('blog')
  })
  it('the sitemap lists the app pages, minus any the admin hid, and only on its own host', () => {
    expect(sitemapXml('https://jodbox.com', {})).toBe('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://jodbox.com/</loc></url><url><loc>https://jodbox.com/chat</loc></url><url><loc>https://jodbox.com/features</loc></url><url><loc>https://jodbox.com/faq</loc></url></urlset>')
    expect(sitemapXml('https://jodbox.com', {}, ['chat'])).not.toContain('/chat')
    expect(sitemapXml('https://jodbox.com', {}, ['faq', 'features'])).not.toContain('/faq')
    const hidden = sitemapXml('https://jodbox.com', { chat: { ...none, noindex: true } })
    expect(hidden).toContain('<loc>https://jodbox.com/</loc>')
    expect(hidden).not.toContain('/chat')
  })
})
