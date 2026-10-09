import type { SeoEntry } from '@sync/shared'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const meta = (attr: 'name' | 'property', key: string, value: string): string => `<meta ${attr}="${key}" content="${esc(value)}">`

/** Applies one page's tags to the head markup: replaces the title and description, appends everything else. */
export function applySeo(head: string, s: SeoEntry, blogUrl: string): string {
  let out = head
  const title = s.title, description = s.description
  if (title) out = /<title[\s>]/.test(out) ? out.replace(/<title[^>]*>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`) : `${out}<title>${esc(title)}</title>`
  if (description) {
    const tag = meta('name', 'description', description)
    out = /<meta[^>]*\bname="description"[^>]*>/.test(out) ? out.replace(/<meta[^>]*\bname="description"[^>]*>/, tag) : `${out}${tag}`
  }
  const extra: string[] = []
  const ogTitle = s.ogTitle || title, ogDescription = s.ogDescription || description
  if (ogTitle) extra.push(meta('property', 'og:title', ogTitle))
  if (ogDescription) extra.push(meta('property', 'og:description', ogDescription))
  if (s.ogImage && blogUrl) { extra.push(meta('property', 'og:image', `${blogUrl}${s.ogImage}`)); extra.push(meta('name', 'twitter:card', 'summary_large_image')) }
  if (ogTitle || ogDescription) extra.push(meta('property', 'og:type', 'website'))
  if (s.noindex) extra.push(meta('name', 'robots', 'noindex, nofollow'))
  if (s.keywords) extra.push(meta('name', 'keywords', s.keywords))
  if (s.canonical) extra.push(`<link rel="canonical" href="${esc(s.canonical)}">`)
  return out + extra.join('')
}
