import type { FastifyInstance } from 'fastify'
import sanitizeHtml from 'sanitize-html'
import { feedbackInputSchema, type SeoEntry } from '@sync/shared'
import { sql } from '../../core/db/client'
import { hashIp } from '../../core/lib/crypto'

const CACHE = 'public, s-maxage=60, stale-while-revalidate=300'
const cached = { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }

interface SeoRow { key: string; title: string; description: string; keywords: string; og_title: string; og_description: string; canonical: string; noindex: boolean; og_path: string | null }

/** Every page the admin has filled in, keyed by SEO page key. The og image is the largest variant of the chosen media. */
export async function seoMap(): Promise<Record<string, SeoEntry>> {
  const rows = await sql<SeoRow[]>`select s.key, s.title, s.description, s.keywords, s.og_title, s.og_description, s.canonical, s.noindex,
    (select v->>'path' from media m, jsonb_array_elements(m.variants_json) as v where m.id = s.og_media_id order by (v->>'w')::int desc limit 1) as og_path
    from seo_pages s`
  return Object.fromEntries(rows.map(r => [r.key, {
    title: r.title, description: r.description, keywords: r.keywords, ogTitle: r.og_title, ogDescription: r.og_description,
    ogImage: r.og_path ? `/media/${r.og_path}` : '', canonical: r.canonical, noindex: r.noindex,
  }]))
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
/** Tags stripped, entities decoded: plain text for JSON-LD and meta tags. */
export const plainText = (html: string): string => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
  .replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m] ?? m).replace(/\s+/g, ' ').trim()

export function engageRoutes(app: FastifyInstance): void {
  app.get('/api/faq', cached, async (_req, reply) => {
    reply.header('cache-control', CACHE)
    const rows = await sql<{ id: string; question: string; answer_html: string; category: string }[]>`
      select id, question, answer_html, category from faqs where published order by position, created_at, id`
    return { items: rows.map(r => ({ id: r.id, question: r.question, answerHtml: r.answer_html, answerText: plainText(r.answer_html), category: r.category })) }
  })

  app.get('/api/seo', cached, async (_req, reply) => {
    reply.header('cache-control', CACHE)
    return seoMap()
  })

  app.post('/api/feedback', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async req => {
    const b = feedbackInputSchema.parse(req.body)
    if (b.website) return { ok: true } // bots fill hidden fields; pretend success and store nothing
    await sql`insert into feedback (name, email, rating, message, ip_hash) values (${b.name}, ${b.email}, ${b.rating}, ${b.message}, ${hashIp(req.ip) ?? 'unknown'})`
    return { ok: true }
  })

  app.get('/api/feedback/public', cached, async (_req, reply) => {
    reply.header('cache-control', CACHE)
    const rows = await sql<{ name: string; rating: number; message: string; created_at: Date }[]>`
      select name, rating, message, created_at from feedback where public order by created_at desc limit 12`
    return { items: rows.map(r => ({ name: r.name || 'Anonymous', rating: r.rating, message: r.message, at: r.created_at.toISOString() })) }
  })
}
