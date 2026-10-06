import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

export function renderMarkdown(src: string): string {
  return sanitizeHtml(md.render(src), {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'em', 'strong', 'hr', 'br', 'del', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }) },
  })
}

export type TocItem = { id: string; text: string; level: 2 | 3 }

const rich = new MarkdownIt({ html: false, linkify: true, breaks: false })

/** Article rendering: headings get ids, images are allowed, TOC is built from h2/h3. */
export function renderArticle(src: string): { html: string; toc: TocItem[]; words: number } {
  const toc: TocItem[] = []
  const used = new Set<string>()
  const tokens = rich.parse(src, {})
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t?.type !== 'heading_open' || (t.tag !== 'h2' && t.tag !== 'h3')) continue
    const text = tokens[i + 1]?.content ?? ''
    let id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'
    for (let n = 2; used.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`
    used.add(id)
    t.attrSet('id', id)
    toc.push({ id, text, level: t.tag === 'h2' ? 2 : 3 })
  }
  const html = sanitizeHtml(rich.renderer.render(tokens, rich.options, {}), {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'em', 'strong', 'hr', 'br', 'del', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'figure', 'figcaption'],
    allowedAttributes: { a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'], h2: ['id'], h3: ['id'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tag, a) => ({ tagName: tag, attribs: /^https?:/i.test(a.href ?? '') ? { ...a, rel: 'noopener nofollow ugc', target: '_blank' } : a }),
      img: (tag, a) => ({ tagName: tag, attribs: { ...a, loading: 'lazy' } }),
    },
  })
  return { html, toc, words: src.split(/\s+/).filter(Boolean).length }
}
