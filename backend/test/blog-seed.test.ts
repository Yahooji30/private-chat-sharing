import { describe, expect, it } from 'vitest'
import { articleInputSchema } from '@sync/shared'
import { SEED_ARTICLES, SEED_CATEGORIES } from '../src/core/db/blog-data'
import { renderArticle } from '../src/core/lib/markdown'

// Data-only checks: they never write to the database, so they cannot disturb the tests that use articles.
describe('starter blog', () => {
  it('has unique slugs and titles, and every article belongs to a real category', () => {
    expect(new Set(SEED_ARTICLES.map(a => a.slug)).size).toBe(SEED_ARTICLES.length)
    expect(new Set(SEED_ARTICLES.map(a => a.title)).size).toBe(SEED_ARTICLES.length)
    const cats = new Set(SEED_CATEGORIES.map(c => c.slug))
    for (const a of SEED_ARTICLES) expect(cats.has(a.category)).toBe(true)
  })

  it('passes the same validation as an article written in the admin, with SEO fields inside their limits', () => {
    for (const a of SEED_ARTICLES) {
      const r = articleInputSchema.parse({ title: a.title, slug: a.slug, excerpt: a.excerpt, body: a.body, tags: a.tags, seoTitle: a.seoTitle, seoDescription: a.seoDescription, status: 'published' })
      expect(r.slug).toBe(a.slug)
      expect(a.seoTitle.length).toBeLessThanOrEqual(70)
      expect(a.seoDescription.length).toBeGreaterThanOrEqual(110); expect(a.seoDescription.length).toBeLessThanOrEqual(160)
      expect(a.excerpt.length).toBeLessThanOrEqual(300)
    }
  })

  it('renders to safe HTML with a table of contents', () => {
    for (const a of SEED_ARTICLES) {
      const { html, toc, words } = renderArticle(a.body)
      expect(toc.length).toBeGreaterThanOrEqual(3)
      expect(words).toBeGreaterThan(300)
      expect(html).not.toMatch(/<script|onerror=/i)
      expect(html).toContain('<h2')
    }
  })
})
