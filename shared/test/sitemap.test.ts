import { describe, expect, it } from 'vitest'
import { SITEMAP_PAGE, blogSitemapEntries, blogSitemapNames } from '../src/index'

describe('the blog sitemap files', () => {
  it('has as many files as the blog needs, and none that are empty', () => {
    expect(blogSitemapNames({ articles: 0, taxonomy: 0 })).toEqual([])
    expect(blogSitemapNames({ articles: 1, taxonomy: 6 })).toEqual(['articles-1', 'taxonomy-1'])
    expect(blogSitemapNames({ articles: SITEMAP_PAGE, taxonomy: 0 })).toEqual(['articles-1'])
    expect(blogSitemapNames({ articles: SITEMAP_PAGE + 1, taxonomy: 0 })).toEqual(['articles-1', 'articles-2'])
    expect(blogSitemapNames({ articles: 12_000, taxonomy: 40 })).toEqual(['articles-1', 'articles-2', 'articles-3', 'taxonomy-1'])
  })
  it('carries when each file last changed', () => {
    const e = blogSitemapEntries({ articles: SITEMAP_PAGE + 1, taxonomy: 3, articleFiles: ['2026-01-01T00:00:00.000Z', '2026-02-02T00:00:00.000Z'], taxonomyLastmod: '2026-03-03T00:00:00.000Z' })
    expect(e).toEqual([
      { name: 'articles-1', lastmod: '2026-01-01T00:00:00.000Z' }, { name: 'articles-2', lastmod: '2026-02-02T00:00:00.000Z' }, { name: 'taxonomy-1', lastmod: '2026-03-03T00:00:00.000Z' },
    ])
    expect(blogSitemapEntries({ articles: 1, taxonomy: 0 })).toEqual([{ name: 'articles-1' }]) // no date known: no date written
  })
})
