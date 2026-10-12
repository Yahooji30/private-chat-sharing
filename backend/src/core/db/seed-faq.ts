import { sql } from './client'
import { SEED_FAQS } from './faq-data'
import { base32 } from '../lib/crypto'
import { renderMarkdown } from '../lib/markdown'

/**
 * Loads the starter FAQ, but only into an empty `faqs` table, so it never overwrites or re-adds anything the admin has
 * written, edited or deleted. Safe to run twice, and safe if two run at once. Returns how many questions were added.
 */
export async function seedFaqs(): Promise<number> {
  return sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(727002)`
    const [r] = await tx<{ n: number }[]>`select count(*)::int as n from faqs`
    if (r?.n) return 0
    for (const [i, f] of SEED_FAQS.entries()) {
      await tx`insert into faqs (id, question, answer_md, answer_html, category, position, published)
        values (${base32(12)}, ${f.question}, ${f.answer}, ${renderMarkdown(f.answer)}, ${f.category}, ${i + 1}, true)`
    }
    return SEED_FAQS.length
  })
}

if (process.argv[1]?.endsWith('seed-faq.ts')) {
  const n = await seedFaqs()
  await sql.end()
  console.log(n ? `Added ${n} FAQ questions. Edit them in Admin > FAQ.` : 'The FAQ already has questions, so nothing was added.')
}
