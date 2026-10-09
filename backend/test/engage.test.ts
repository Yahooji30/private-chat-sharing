import { hash } from '@node-rs/argon2'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from '../src/core/db/client'
import { boot } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
const PW = 'Sup3r-secret-pass'
const visitor = (n: number) => ({ 'x-forwarded-for': `93.7.${n}.1`, cookie: `sid_dev=engage${String(n).padStart(2, '0')}`.padEnd(32, '0') })

interface Sess { cookie: string; csrf: string }
let s: Sess
async function login(): Promise<Sess> {
  const res = await t.api.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { 'x-forwarded-for': '93.7.0.1' }, payload: { email: 'engage@x.io', password: PW } })
  const raw = res.headers['set-cookie']
  const c = Object.fromEntries((Array.isArray(raw) ? raw : [String(raw)]).map(x => { const [kv = ''] = x.split(';'); const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)] }))
  return { cookie: `sid_adm=${c.sid_adm}; csrf_adm=${c.csrf_adm}`, csrf: c.csrf_adm as string }
}
/** `who` null = no session at all */
async function admin(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown, who: Sess | null = s) {
  const r = await t.api.inject({ method, url, headers: { 'x-forwarded-for': '93.7.0.1', ...(who ? { cookie: who.cookie } : {}), ...(who && method !== 'GET' ? { 'x-csrf': who.csrf } : {}) }, ...(body === undefined ? {} : { payload: body as object }) })
  return { status: r.statusCode, body: r.json() as any }
}
async function pub(method: 'GET' | 'POST', url: string, n = 1, body?: unknown) {
  const r = await t.api.inject({ method, url, headers: visitor(n), ...(body === undefined ? {} : { payload: body as object }) })
  return { status: r.statusCode, body: r.json() as any, headers: r.headers }
}

beforeAll(async () => {
  t = await boot()
  await sql`insert into admins (id, email, name, password_hash, role) values ('eng1', 'engage@x.io', 'Eve Engage', ${await hash(PW)}, 'owner')`
  s = await login()
})
afterAll(async () => { await t.close() })

describe('faq', () => {
  it('needs an admin session to manage questions', async () => {
    expect((await admin('GET', '/api/admin/faqs', undefined, null)).status).toBe(401)
    expect((await admin('POST', '/api/admin/faqs', { question: 'Q?', answer: 'A' }, { ...s, csrf: 'bad' })).status).toBe(403)
  })

  it('creates, orders, hides drafts, renders safe markdown and deletes', async () => {
    const a = await admin('POST', '/api/admin/faqs', { question: 'Is it free?', answer: 'Yes, **free**.\n\n<script>alert(1)</script>', category: 'General' })
    const b = await admin('POST', '/api/admin/faqs', { question: 'Is it private?', answer: 'Yes. See [privacy](https://example.com/privacy).', category: 'Privacy' })
    const c = await admin('POST', '/api/admin/faqs', { question: 'Hidden one', answer: 'Not yet', published: false })
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200])
    expect((await admin('POST', '/api/admin/faqs', { question: 'x', answer: 'short question' })).status).toBe(400)

    const list = (await pub('GET', '/api/faq')).body.items
    expect(list.map((i: any) => i.question)).toEqual(['Is it free?', 'Is it private?'])
    expect(list[0].answerHtml).toContain('<strong>free</strong>')
    expect(list[0].answerHtml).not.toContain('<script')
    expect(list[0].answerText).toBe('Yes, free. <script>alert(1)</script>') // shown as text, never executed
    expect(list[0].answerText).not.toContain('<strong>')
    expect(list[0].category).toBe('General')
    expect(list[1].answerHtml).toContain('<a href="https://example.com/privacy">privacy</a>')

    await admin('POST', '/api/admin/faqs/reorder', { ids: [b.body.id, a.body.id, c.body.id] })
    expect((await pub('GET', '/api/faq')).body.items.map((i: any) => i.question)).toEqual(['Is it private?', 'Is it free?'])
    expect((await admin('GET', '/api/admin/faqs')).body.map((i: any) => i.question)).toEqual(['Is it private?', 'Is it free?', 'Hidden one'])

    expect((await admin('PUT', `/api/admin/faqs/${c.body.id}`, { question: 'Hidden one', answer: 'Now live', published: true })).status).toBe(200)
    expect((await pub('GET', '/api/faq')).body.items).toHaveLength(3)
    expect((await admin('DELETE', `/api/admin/faqs/${c.body.id}`)).status).toBe(200)
    expect((await admin('DELETE', `/api/admin/faqs/${c.body.id}`)).status).toBe(404)
    expect((await admin('PUT', '/api/admin/faqs/nope', { question: 'Whatever?', answer: 'x' })).status).toBe(404)
    expect((await pub('GET', '/api/faq')).headers['cache-control']).toContain('s-maxage=60')
  })

  it('decodes entities in the plain-text answer used for structured data', async () => {
    await admin('POST', '/api/admin/faqs', { question: 'Tom & Jerry?', answer: 'Cats & mice <3' })
    const item = (await pub('GET', '/api/faq')).body.items.find((i: any) => i.question === 'Tom & Jerry?')
    expect(item.answerText).toBe('Cats & mice <3')
  })
})

describe('feedback', () => {
  const ok = { rating: 5, message: 'Love the chat rooms, very quick.', name: 'Asha', email: 'asha@example.com' }

  it('validates input and stores it for the inbox', async () => {
    // each from its own network: rejected requests also count towards the hourly limit
    expect((await pub('POST', '/api/feedback', 4, { ...ok, rating: 0 })).status).toBe(400)
    expect((await pub('POST', '/api/feedback', 5, { ...ok, rating: 6 })).status).toBe(400)
    expect((await pub('POST', '/api/feedback', 6, { ...ok, message: 'hey' })).status).toBe(400)
    expect((await pub('POST', '/api/feedback', 7, { ...ok, email: 'not-an-email' })).status).toBe(400)
    expect((await pub('POST', '/api/feedback', 1, ok)).status).toBe(200)
    expect((await pub('POST', '/api/feedback', 1, { rating: 3, message: 'Anonymous but useful note' })).status).toBe(200)
    const inbox = (await admin('GET', '/api/admin/feedback')).body
    expect(inbox.total).toBe(2); expect(inbox.unread).toBe(2)
    expect(inbox.items[1]).toMatchObject({ name: 'Asha', email: 'asha@example.com', rating: 5, status: 'new', public: false })
    expect(JSON.stringify(inbox)).not.toContain('ip_hash')
  })

  it('swallows honeypot submissions without storing them', async () => {
    const r = await pub('POST', '/api/feedback', 2, { ...ok, message: 'Buy cheap watches now', website: 'http://spam.example' })
    expect(r.status).toBe(200)
    expect((await admin('GET', '/api/admin/feedback')).body.items.map((i: any) => i.message)).not.toContain('Buy cheap watches now')
  })

  it('rate limits one network to 5 submissions an hour', async () => {
    const codes: number[] = []
    for (let i = 0; i < 7; i++) codes.push((await pub('POST', '/api/feedback', 3, { ...ok, message: `Message number ${i} here` })).status)
    expect(codes.filter(c => c === 200)).toHaveLength(5)
    expect(codes.slice(5)).toEqual([429, 429])
  })

  it('shows only feedback the admin made public, and hides it again', async () => {
    expect((await pub('GET', '/api/feedback/public')).body.items).toEqual([])
    const id = (await admin('GET', '/api/admin/feedback')).body.items.find((i: any) => i.name === 'Asha').id
    expect((await admin('PATCH', `/api/admin/feedback/${id}`, { public: true, status: 'read' })).status).toBe(200)
    const shown = (await pub('GET', '/api/feedback/public')).body.items
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatchObject({ name: 'Asha', rating: 5 })
    expect(JSON.stringify(shown)).not.toContain('asha@example.com')
    expect((await admin('GET', '/api/admin/feedback?status=read')).body.total).toBe(1)
    expect((await admin('PATCH', `/api/admin/feedback/${id}`, { public: false })).status).toBe(200)
    expect((await pub('GET', '/api/feedback/public')).body.items).toEqual([])
    expect((await admin('PATCH', '/api/admin/feedback/999999', { status: 'read' })).status).toBe(404)
    expect((await admin('PATCH', '/api/admin/feedback/abc', { status: 'read' })).status).toBe(404)
    expect((await admin('PATCH', `/api/admin/feedback/${id}`, { status: 'weird' })).status).toBe(400)
    expect((await admin('DELETE', `/api/admin/feedback/${id}`)).status).toBe(200)
    expect((await admin('DELETE', `/api/admin/feedback/${id}`)).status).toBe(404)
  })

  it('names unnamed public feedback "Anonymous"', async () => {
    const id = (await admin('GET', '/api/admin/feedback')).body.items.find((i: any) => i.name === '').id
    await admin('PATCH', `/api/admin/feedback/${id}`, { public: true })
    expect((await pub('GET', '/api/feedback/public')).body.items[0].name).toBe('Anonymous')
  })
})

describe('seo', () => {
  it('lists every manageable page and starts empty', async () => {
    const rows = (await admin('GET', '/api/admin/seo')).body
    expect(rows.map((r: any) => r.key)).toEqual(['home', 'chat', 'blog', 'features', 'faq', 'feedback', 'privacy', 'terms'])
    expect(rows.every((r: any) => r.title === '' && r.noindex === false)).toBe(true)
    expect((await pub('GET', '/api/seo')).body).toEqual({})
  })

  it('saves tags per page and exposes them publicly', async () => {
    const put = await admin('PUT', '/api/admin/seo/faq', { title: 'FAQ - Sync', description: 'Answers to common questions.', keywords: 'sync, faq', ogTitle: 'Sync FAQ', canonical: 'https://example.com/faq', noindex: false })
    expect(put.status).toBe(200)
    await admin('PUT', '/api/admin/seo/privacy', { noindex: true })
    const map = (await pub('GET', '/api/seo')).body
    expect(map.faq).toMatchObject({ title: 'FAQ - Sync', description: 'Answers to common questions.', keywords: 'sync, faq', ogTitle: 'Sync FAQ', canonical: 'https://example.com/faq', noindex: false, ogImage: '' })
    expect(map.privacy).toMatchObject({ noindex: true, title: '' })
    expect(map.home).toBeUndefined()
    const back = (await admin('GET', '/api/admin/seo')).body.find((r: any) => r.key === 'faq')
    expect(back).toMatchObject({ title: 'FAQ - Sync', path: '/faq', site: 'site' })
  })

  it('rejects unknown pages, bad canonicals and unknown images', async () => {
    expect((await admin('PUT', '/api/admin/seo/nope', { title: 'x' })).status).toBe(404)
    expect((await admin('PUT', '/api/admin/seo/home', { canonical: 'javascript:alert(1)' })).status).toBe(400)
    expect((await admin('PUT', '/api/admin/seo/home', { title: 'x'.repeat(121) })).status).toBe(400)
    expect((await admin('PUT', '/api/admin/seo/home', { ogMediaId: 'missing' })).status).toBe(400)
    expect((await admin('PUT', '/api/admin/seo/home', { title: 'Ok' }, null)).status).toBe(401)
  })

  it('resolves the social image to the biggest uploaded variant, and clears a page when emptied', async () => {
    await sql`insert into media (id, filename, mime, width, height, bytes, variants_json) values ('m-og', 'og.png', 'image/png', 1300, 700, 10,
      ${sql.json([{ w: 640, h: 345, path: 'm-og-640.webp', bytes: 1 }, { w: 1280, h: 690, path: 'm-og-1280.webp', bytes: 2 }])})`
    expect((await admin('PUT', '/api/admin/seo/home', { title: 'Home page', ogMediaId: 'm-og' })).status).toBe(200)
    expect((await pub('GET', '/api/seo')).body.home.ogImage).toBe('/media/m-og-1280.webp')
    expect((await admin('PUT', '/api/admin/seo/home', {})).status).toBe(200)
    expect((await pub('GET', '/api/seo')).body.home).toBeUndefined()
  })
})

describe('chat invite message', () => {
  it('is editable by the admin, limited in length, and public for the app', async () => {
    expect((await admin('PUT', '/api/admin/site-settings', { chat_share_message: 'Secret for you {link}' })).status).toBe(200)
    expect((await pub('GET', '/api/site')).body.chat_share_message).toBe('Secret for you {link}')
    expect((await admin('PUT', '/api/admin/site-settings', { chat_share_message: 'x'.repeat(501) })).status).toBe(400)
  })
})
