import type { SeoEntry } from '@sync/shared'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** https://example.com/blog -> https://example.com */
export const originOf = (url: string): string => { try { return new URL(url).origin } catch { return url } }
const meta = (attr: 'name' | 'property', key: string, value: string): string => `<meta ${attr}="${key}" content="${esc(value)}">`

/** What the page itself would say if the admin has not written anything for it. */
export interface Fallback {
  title: string
  description: string
  /** this page's own address */
  url: string
  /** the address search engines should treat as the real one */
  canonical: string
  /** full address of the sharing picture */
  image: string
}

const NONE: SeoEntry = { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '', canonical: '', noindex: false }

/**
 * Puts a page's tags into the head markup the server sends first, so crawlers and link previews (WhatsApp, Facebook, X) see them
 * without running the app: the admin's values (Admin > SEO) win, `fallback` fills what they left empty. Title and description
 * replace the ones already there; everything else is appended.
 */
export function applySeo(head: string, entry: SeoEntry | undefined, blogUrl: string, fallback?: Fallback): string {
  const s = entry ?? NONE
  const title = s.title || fallback?.title || ''
  const description = s.description || fallback?.description || ''
  let out = head
  if (title) out = /<title[\s>]/.test(out) ? out.replace(/<title[^>]*>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`) : `${out}<title>${esc(title)}</title>`
  if (description) {
    const tag = meta('name', 'description', description)
    out = /<meta[^>]*\bname="description"[^>]*>/.test(out) ? out.replace(/<meta[^>]*\bname="description"[^>]*>/, tag) : `${out}${tag}`
  }
  const extra: string[] = []
  const ogTitle = s.ogTitle || title
  const ogDescription = s.ogDescription || description
  // pictures live at the root of the website; the blog address may carry a folder (https://example.com/blog)
  const image = s.ogImage && blogUrl ? `${originOf(blogUrl)}${s.ogImage}` : fallback?.image
  if (ogTitle) extra.push(meta('property', 'og:title', ogTitle))
  if (ogDescription) extra.push(meta('property', 'og:description', ogDescription))
  if (image) { extra.push(meta('property', 'og:image', image)); extra.push(meta('name', 'twitter:card', 'summary_large_image')) }
  if (ogTitle || ogDescription) extra.push(meta('property', 'og:type', 'website'))
  if (fallback) extra.push(meta('property', 'og:url', fallback.url))
  if (s.noindex) extra.push(meta('name', 'robots', 'noindex, nofollow'))
  if (s.keywords) extra.push(meta('name', 'keywords', s.keywords))
  const canonical = s.canonical || fallback?.canonical
  if (canonical) extra.push(`<link rel="canonical" href="${esc(canonical)}">`)
  return out + extra.join('')
}

export interface PageInfo {
  key: string
  title: string
  description: string
  /** where this page's copy that search engines index lives, when it is not this app */
  blogPath?: string
}

/** The pages search engines and link previews care about, by address. Keys match Admin > SEO. */
export function pageInfo(path: string, name: string): PageInfo | null {
  switch (path) {
    case '/': return { key: 'home', title: `${name}: share text and files across your devices`, description: `${name}: type on one device, see it on every device on your network. Share text and files instantly, privately, with no sign-up.` }
    case '/chat': return { key: 'chat', title: `Secure Chat | ${name}`, description: 'Start a private, end-to-end encrypted chat room in seconds. Password protected, up to four people, no accounts and no history.' }
    case '/faq': return { key: 'faq', title: `FAQ | ${name}`, description: `Answers to common questions about ${name}: sharing text and files between devices, linking networks, secure chat rooms and privacy.` }
    case '/features': return { key: 'features', title: `Features | ${name}`, description: `Everything ${name} does: live text sync, device-to-device file transfer, QR linking, end-to-end encrypted chat rooms and more. Free, private, no sign-up.` }
    case '/privacy': return { key: 'privacy', title: `Privacy | ${name}`, description: `How ${name} handles your data: no raw IP addresses, encrypted text, peer-to-peer files and end-to-end encrypted chat.`, blogPath: '/privacy' }
    case '/terms': return { key: 'terms', title: `Terms | ${name}`, description: `The terms of using ${name}.`, blogPath: '/terms' }
    case '/blog': return { key: 'blog', title: `Blog | ${name}`, description: `Guides, tips and news from ${name}: sharing text and files between devices, privacy and productivity.`, blogPath: '/' }
    default: return null
  }
}

/** The address as the visitor typed it, without a query string or a trailing slash. */
export const cleanPath = (url: string): string => (url.split('?')[0]?.split('#')[0] ?? '/').replace(/\/+$/, '') || '/'

/** Every page the app has. A test checks this list against the files in app/pages, so a new page cannot be forgotten. */
const ROUTES = [/^\/$/, /^\/chat$/, /^\/faq$/, /^\/features$/, /^\/privacy$/, /^\/terms$/, /^\/link$/, /^\/blog$/, /^\/c\/[^/]+$/, /^\/blog\/category\/[^/]+$/, /^\/blog\/tag\/[^/]+$/, /^\/blog\/[^/]+$/]
export const isKnownRoute = (path: string): boolean => ROUTES.some(r => r.test(path))

/** True for a request for a page (not a file): such a request for an unknown address should be answered with 404. */
export const wantsPage = (path: string, accept: string): boolean => accept.includes('text/html') && !/\.[a-z0-9]{1,8}$/i.test(path)

export function robotsTxt(origin: string, _blogUrl = ''): string {
  return [
    'User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /c/', 'Disallow: /link', 'Disallow: /settings', '',
    // one sitemap for everything: it lists the site pages file and the blog's files
    `Sitemap: ${origin}/sitemap.xml`, '',
  ].join('\n')
}

/**
 * The one sitemap of the whole website: the site pages file (/sitemap-pages.xml) and every file of the blog's sitemap. (A sitemap index may not list another index,
 * so the blog's files are named here one by one.)
 */
export function sitemapIndexXml(origin: string, blogUrl: string, blogFiles: (string | { name: string; lastmod?: string })[]): string {
  const entry = (loc: string, lastmod?: string): string => `<sitemap><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${esc(lastmod)}</lastmod>` : ''}</sitemap>`
  const blog = blogUrl ? blogFiles.map(f => (typeof f === 'string' ? entry(`${blogUrl}/sitemaps/${f}.xml`) : entry(`${blogUrl}/sitemaps/${f.name}.xml`, f.lastmod))) : []
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[entry(`${origin}/sitemap-pages.xml`), ...blog].join('')}</sitemapindex>`
}

/** The app's own sitemap (home, chat, features, FAQ). A sitemap may only list addresses on its own host, so the blog's pages are in the blog site's sitemap. */
export function sitemapXml(origin: string, seo: Record<string, SeoEntry>, off: readonly string[] = []): string {
  const pages = [['home', '/'], ['chat', '/chat'], ['features', '/features'], ['faq', '/faq']] as const
  const urls = pages.filter(([key]) => !seo[key]?.noindex && !off.includes(key)).map(([, path]) => `<url><loc>${esc(origin + path)}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`
}
