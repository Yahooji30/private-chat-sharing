import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from '../src/core/db/client'
import { SEED_FAQS } from '../src/core/db/faq-data'
import { seedFaqs } from '../src/core/db/seed-faq'

beforeAll(async () => { await sql`delete from faqs` })
afterAll(async () => { await sql`delete from faqs`; await sql.end() })

describe('starter FAQ', () => {
  it('has well-formed questions: unique, answered, grouped, no stray HTML', () => {
    const qs = SEED_FAQS.map(f => f.question)
    expect(new Set(qs).size).toBe(qs.length)
    for (const f of SEED_FAQS) {
      expect(f.question.length).toBeGreaterThanOrEqual(3); expect(f.question.length).toBeLessThanOrEqual(300)
      expect(f.answer.length).toBeGreaterThan(20); expect(f.answer.length).toBeLessThanOrEqual(5000)
      expect(f.category.length).toBeLessThanOrEqual(60); expect(f.category).not.toBe('')
      expect(f.answer).not.toMatch(/<\/?[a-z]+/i)
      // visitor-facing only: nothing about running the site
      expect(`${f.question} ${f.answer}`).not.toMatch(/\badmin|moderat|dashboard|backend/i)
      // questions are things a visitor wants to do or know, not complaints
      expect(f.question).not.toMatch(/\b(forgot|stuck|slow|not (syncing|working)|won't|cannot|can't|fail|error|broken)\b/i)
    }
  })

  it('loads into an empty table in order, with rendered, safe HTML', async () => {
    expect(await seedFaqs()).toBe(SEED_FAQS.length)
    const rows = await sql<{ question: string; answer_html: string; category: string; position: number; published: boolean }[]>`select question, answer_html, category, position, published from faqs order by position`
    expect(rows.map(r => r.question)).toEqual(SEED_FAQS.map(f => f.question))
    expect(rows.every(r => r.published && r.answer_html.startsWith('<'))).toBe(true)
    expect(rows.map(r => r.position)).toEqual(rows.map((_, i) => i + 1))
    expect(rows[0]?.answer_html).toContain('<strong>files</strong>')
    expect(rows.some(r => r.answer_html.includes('<script'))).toBe(false)
  })

  it('never touches an FAQ the admin already has, and a second run adds nothing', async () => {
    expect(await seedFaqs()).toBe(0)
    await sql`delete from faqs where position > 3`
    expect(await seedFaqs()).toBe(0)
    expect((await sql`select 1 from faqs`).length).toBe(3)
  })
})
