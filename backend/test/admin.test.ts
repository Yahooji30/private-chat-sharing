import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { hash } from '@node-rs/argon2'
import { generateSync } from 'otplib'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { publishDue } from '../src/core/blog'
import { sql } from '../src/core/db/client'
import { boot, client } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
const ip = client('90.1.1.1', 'adminadminadmin1')
const PW = 'Sup3r-secret-pass'
beforeAll(async () => {
  t = await boot()
  await sql`insert into admins (id, email, name, password_hash, role) values ('own1', 'owner@x.io', 'Olly Owner', ${await hash(PW)}, 'owner')`
})
afterAll(async () => { await t.close() })

interface Sess { cookie: string; csrf: string }
function parseCookies(res: { headers: Record<string, unknown> }): Record<string, string> {
  const raw = res.headers['set-cookie']
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : []
  return Object.fromEntries(list.map(c => { const [kv = ''] = c.split(';'); const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)] }))
}
async function login(email = 'owner@x.io', password = PW, from = ip): Promise<{ status: number; body: any; sess?: Sess }> {
  const res = await t.api.inject({ method: 'POST', url: '/api/admin/auth/login', headers: { 'x-forwarded-for': from.ip }, payload: { email, password } })
  const c = parseCookies(res)
  return { status: res.statusCode, body: res.json(), sess: c.sid_adm ? { cookie: `sid_adm=${c.sid_adm}; csrf_adm=${c.csrf_adm}`, csrf: c.csrf_adm as string } : undefined }
}
async function call(s: Sess | undefined, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, csrf = true) {
  const res = await t.api.inject({ method, url: path, headers: { 'x-forwarded-for': ip.ip, ...(s ? { cookie: s.cookie } : {}), ...(s && csrf && method !== 'GET' ? { 'x-csrf': s.csrf } : {}) }, ...(body === undefined ? {} : { payload: body as object }) })
  return { status: res.statusCode, body: res.json() as any }
}
const pub = async (path: string) => { const r = await t.api.inject({ method: 'GET', url: path, headers: { 'x-forwarded-for': '91.2.2.2', cookie: 'sid_dev=publicreader00000' } }); return { status: r.statusCode, body: r.json() as any, headers: r.headers } }

describe('admin auth', () => {
  it('requires a session and a CSRF token', async () => {
    expect((await call(undefined, 'GET', '/api/admin/auth/me')).status).toBe(401)
    const { sess } = await login()
    expect(sess).toBeTruthy()
    const me = await call(sess, 'GET', '/api/admin/auth/me')
    expect(me.body).toMatchObject({ email: 'owner@x.io', role: 'owner' })
    expect((await call(sess, 'POST', '/api/admin/categories', { name: 'X' }, false)).status).toBe(403)
    expect((await call(sess, 'POST', '/api/admin/categories', { name: 'Csrf OK' })).status).toBe(200)
    const out = await call(sess, 'POST', '/api/admin/auth/logout')
    expect(out.status).toBe(200)
    expect((await call(sess, 'GET', '/api/admin/auth/me')).status).toBe(401)
  })

  it('rejects bad credentials the same way and locks out after 5 failures', async () => {
    const lockIp = client('90.9.9.9', 'lockerlockerlock1')
    const a = await login('owner@x.io', 'wrong-password-1', lockIp)
    const b = await login('nobody@x.io', 'wrong-password-1', lockIp)
    expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.body.error.message).toBe(b.body.error.message)
    for (let i = 0; i < 3; i++) await login('nobody2@x.io', 'x', lockIp)
    expect((await login('owner@x.io', PW, lockIp)).body.error.code).toBe('ACCOUNT_LOCKED')
  })

  it('totp: setup, enable, then login needs a valid code', async () => {
    const { sess } = await login()
    const setup = await call(sess, 'POST', '/api/admin/auth/totp/setup')
    expect(setup.body.qr).toContain('data:image/png')
    expect((await call(sess, 'POST', '/api/admin/auth/totp/enable', { code: '000000' })).status).toBe(400)
    expect((await call(sess, 'POST', '/api/admin/auth/totp/enable', { code: generateSync({ secret: setup.body.secret }) })).status).toBe(200)
    const l = await login()
    expect(l.body.totpRequired).toBe(true); expect(l.sess).toBeUndefined()
    const bad = await t.api.inject({ method: 'POST', url: '/api/admin/auth/totp', headers: { 'x-forwarded-for': ip.ip }, payload: { pendingToken: l.body.pendingToken, code: '123456' } })
    expect(bad.statusCode).toBe(401)
    const good = await t.api.inject({ method: 'POST', url: '/api/admin/auth/totp', headers: { 'x-forwarded-for': ip.ip }, payload: { pendingToken: l.body.pendingToken, code: generateSync({ secret: setup.body.secret }) } })
    expect(good.statusCode).toBe(200)
    const c = parseCookies(good)
    const s2 = { cookie: `sid_adm=${c.sid_adm}; csrf_adm=${c.csrf_adm}`, csrf: c.csrf_adm as string }
    expect((await call(s2, 'GET', '/api/admin/auth/me')).body.totpEnabled).toBe(true)
    expect((await call(s2, 'POST', '/api/admin/auth/totp/disable')).status).toBe(200)
  })

  it('expires sessions and slides them forward', async () => {
    const { sess } = await login()
    await sql`update admin_sessions set expires_at = now() + interval '1 hour'`
    expect((await call(sess, 'GET', '/api/admin/auth/me')).status).toBe(200)
    const [r] = await sql<{ expires_at: Date }[]>`select expires_at from admin_sessions order by expires_at desc limit 1`
    expect(r!.expires_at.getTime() - Date.now()).toBeGreaterThan(10 * 3600_000)
    await sql`update admin_sessions set expires_at = now() - interval '1 minute'`
    expect((await call(sess, 'GET', '/api/admin/auth/me')).status).toBe(401)
  })

  it('manages admins as owner, protects the last owner, and changes password', async () => {
    const { sess } = await login()
    expect((await call(sess, 'POST', '/api/admin/admins', { email: 'ed@x.io', name: 'Ed', password: 'short' })).status).toBe(400)
    expect((await call(sess, 'POST', '/api/admin/admins', { email: 'ed@x.io', name: 'Ed', password: 'Editor-pass-12345' })).status).toBe(200)
    expect((await call(sess, 'POST', '/api/admin/admins', { email: 'ed@x.io', name: 'Ed', password: 'Editor-pass-12345' })).status).toBe(409)
    const ed = (await login('ed@x.io', 'Editor-pass-12345')).sess
    expect((await call(ed, 'GET', '/api/admin/admins')).status).toBe(403)
    expect((await call(sess, 'DELETE', '/api/admin/admins/own1')).body.error.code).toBe('CONFLICT')
    expect((await call(ed, 'POST', '/api/admin/auth/password', { old: 'bad', next: 'Another-long-pass-1' })).status).toBe(401)
    expect((await call(ed, 'POST', '/api/admin/auth/password', { old: 'Editor-pass-12345', next: 'Another-long-pass-1' })).status).toBe(200)
    expect((await login('ed@x.io', 'Another-long-pass-1')).status).toBe(200)
    const list = (await call(sess, 'GET', '/api/admin/admins')).body
    await call(sess, 'DELETE', `/api/admin/admins/${list.find((a: any) => a.email === 'ed@x.io').id}`)
    const audit = (await call(sess, 'GET', '/api/admin/audit')).body
    expect(audit.items.map((a: any) => a.action)).toContain('admin.create')
  })
})

describe('blog', () => {
  let s: Sess, cat: string
  beforeAll(async () => {
    s = (await login()).sess as Sess
    cat = (await call(s, 'POST', '/api/admin/categories', { name: 'Guides' })).body.id
  })
  const post = (o: object) => call(s, 'POST', '/api/admin/articles', { title: 'Hello World', body: '## First\n\nText', status: 'published', ...o })

  it('keeps drafts private, publishes with html, toc, reading time and unique slugs', async () => {
    const d = await post({ title: 'Secret draft', status: 'draft' })
    expect((await pub(`/api/blog/articles/${d.body.slug}`)).status).toBe(404)
    expect((await pub('/api/blog/articles')).body.items.map((i: any) => i.slug)).not.toContain(d.body.slug)
    const a = await post({ body: '## Intro\n\nSome **bold** words <script>x</script>\n\n### Details\n\n' + 'word '.repeat(450), categoryId: cat, tags: ['News', 'Tips'] })
    const b = await post({ categoryId: cat })
    expect(a.body.slug).toBe('hello-world'); expect(b.body.slug).toBe('hello-world-2')
    const got = (await pub('/api/blog/articles/hello-world')).body
    expect(got.html).toContain('<h2 id="intro">Intro</h2>'); expect(got.html).not.toContain('<script')
    expect(got.toc).toEqual([{ id: 'intro', text: 'Intro', level: 2 }, { id: 'details', text: 'Details', level: 3 }])
    expect(got.readingMin).toBe(2)
    expect(got.tags.map((x: any) => x.slug)).toEqual(['news', 'tips'])
    expect(got.category).toMatchObject({ slug: 'guides' })
    expect(got.related.map((x: any) => x.slug)).toEqual(['hello-world-2'])
    const edit = await call(s, 'PUT', `/api/admin/articles/${a.body.id}`, { title: 'Hello World', body: 'new', status: 'published', slug: 'hello-world-2' })
    expect(edit.body.slug).toBe('hello-world-2-2')
  })

  it('schedules in the future and the job publishes it', async () => {
    expect((await post({ status: 'scheduled', publishAt: new Date(Date.now() - 1000).toISOString() })).status).toBe(400)
    const sc = await post({ title: 'Later', status: 'scheduled', publishAt: new Date(Date.now() + 3600_000).toISOString() })
    expect((await pub(`/api/blog/articles/${sc.body.slug}`)).status).toBe(404)
    await sql`update articles set publish_at = now() - interval '1 second' where id = ${sc.body.id}`
    expect(await publishDue()).toBe(1)
    expect((await pub(`/api/blog/articles/${sc.body.slug}`)).status).toBe(200)
    await call(s, 'PUT', `/api/admin/articles/${sc.body.id}`, { title: 'Later', status: 'archived' })
    expect((await pub(`/api/blog/articles/${sc.body.slug}`)).status).toBe(404)
  })

  it('paginates 12 per page and filters by category, tag and search', async () => {
    for (let i = 0; i < 13; i++) await post({ title: `Bulk ${i}`, body: i === 0 ? 'zebra crossing' : 'filler', tags: ['bulk'] })
    const p1 = (await pub('/api/blog/articles')).body, p2 = (await pub('/api/blog/articles?page=2')).body
    expect(p1.items).toHaveLength(12); expect(p2.items.length).toBeGreaterThan(0); expect(p1.pages).toBeGreaterThanOrEqual(2)
    expect((await pub('/api/blog/articles?q=zebra')).body.items).toHaveLength(1)
    expect((await pub('/api/blog/articles?category=guides')).body.items.length).toBeGreaterThan(0)
    expect((await pub('/api/blog/tags/bulk')).body.total).toBe(13)
    expect((await pub('/api/blog/tags/nope')).status).toBe(404)
    expect((await pub('/api/blog/articles?page=0')).status).toBe(400)
    const cats = (await pub('/api/blog/categories')).body
    expect(cats.find((c: any) => c.slug === 'guides').count).toBeGreaterThan(0)
  })

  it('serves sitemap and rss data and cache headers; admin list filters', async () => {
    const sm = (await pub('/api/sitemap-data')).body
    expect(sm.articles.map((a: any) => a.slug)).toContain('hello-world-2'); expect(sm.categories).toContain('guides'); expect(sm.tags).toContain('bulk')
    expect((await pub('/api/blog/rss-data')).body.length).toBeLessThanOrEqual(30)
    expect((await pub('/api/blog/articles')).headers['cache-control']).toContain('s-maxage=60')
    const l = (await call(s, 'GET', '/api/admin/articles?status=draft')).body
    expect(l.items.every((i: any) => i.status === 'draft')).toBe(true)
    expect((await call(s, 'POST', '/api/admin/articles/preview', { body: '## Hi' })).body.html).toContain('<h2 id="hi">')
    expect((await call(s, 'DELETE', '/api/admin/categories/missing')).status).toBe(404)
  })
})

describe('media', () => {
  let s: Sess
  beforeAll(async () => { s = (await login()).sess as Sess })
  async function upload(buf: Buffer, name: string, type: string) {
    const fd = new FormData(); fd.append('file', new Blob([new Uint8Array(buf)], { type }), name)
    const r = new Response(fd)
    const res = await t.api.inject({ method: 'POST', url: '/api/admin/media', headers: { cookie: s.cookie, 'x-csrf': s.csrf, 'content-type': r.headers.get('content-type') as string, 'x-forwarded-for': ip.ip }, payload: Buffer.from(await r.arrayBuffer()) })
    return { status: res.statusCode, body: res.json() as any }
  }

  it('stores webp variants for a big png, rejects non images, and blocks deleting used images', async () => {
    const png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#e85a5a' } }).png().toBuffer()
    const up = await upload(png, 'hero.png', 'image/png')
    expect(up.status).toBe(200)
    expect(up.body.variants.map((v: any) => v.w)).toEqual([480, 960, 1600, 2000])
    for (const v of up.body.variants) expect(existsSync(join('/tmp/sync-test-media', v.path))).toBe(true)
    expect((await upload(Buffer.from('<?php echo 1; ?>'), 'x.png', 'image/png')).status).toBe(400)
    expect((await upload(Buffer.from('GIF89a'), 'x.gif', 'image/gif')).status).toBe(400)
    const small = await upload(await sharp({ create: { width: 100, height: 80, channels: 3, background: '#000' } }).jpeg().toBuffer(), 'tiny.jpg', 'image/jpeg')
    expect(small.body.variants).toHaveLength(1)
    const art = await call(s, 'POST', '/api/admin/articles', { title: 'With cover', status: 'published', coverMediaId: up.body.id })
    expect((await pub(`/api/blog/articles/${art.body.slug}`)).body.cover.variants).toHaveLength(4)
    expect((await call(s, 'DELETE', `/api/admin/media/${up.body.id}`)).status).toBe(409)
    expect((await call(s, 'PATCH', `/api/admin/media/${up.body.id}`, { alt: 'A red banner' })).status).toBe(200)
    await call(s, 'DELETE', `/api/admin/articles/${art.body.id}`)
    expect((await call(s, 'DELETE', `/api/admin/media/${up.body.id}`)).status).toBe(200)
    expect(existsSync(join('/tmp/sync-test-media', up.body.variants[0].path))).toBe(false)
    expect((await call(s, 'POST', '/api/admin/articles', { title: 'Bad', coverMediaId: 'nope' })).status).toBe(400)
    const list = (await call(s, 'GET', '/api/admin/media')).body
    expect(list.items.length).toBeGreaterThan(0)
  })
})

describe('admin ops', () => {
  let s: Sess
  beforeAll(async () => { s = (await login()).sess as Sess })
  const user = client('92.3.3.3', 'reporterreporter1')

  it('shows reports, unpublishes a reported page, and resolves it', async () => {
    const c = await t.call(user, 'POST', '/api/public-pages', { title: 'Bad page', body: 'spam', slug: 'bad-page' })
    expect(c.status).toBe(200)
    await t.call(client('93.4.4.4', 'othervieweroooo01'), 'POST', '/api/p/bad-page/report', { reason: 'this is spam' })
    const reports = (await call(s, 'GET', '/api/admin/reports')).body
    expect(reports[0]).toMatchObject({ slug: 'bad-page', reason: 'this is spam', resolved: false })
    expect((await call(s, 'GET', '/api/admin/stats')).body.openReports).toBe(1)
    expect((await call(s, 'POST', '/api/admin/public-pages/bad-page/unpublish')).status).toBe(200)
    expect((await t.call(user, 'GET', '/api/p/bad-page')).status).toBe(404)
    expect((await call(s, 'GET', '/api/admin/reports')).body[0].resolved).toBe(true)
    expect((await call(s, 'POST', `/api/admin/reports/${reports[0].id}/resolve`)).status).toBe(404)
  })

  it('reports stats as counts only', async () => {
    const st = (await call(s, 'GET', '/api/admin/stats')).body
    expect(Object.keys(st)).toEqual(expect.arrayContaining(['onlineDevices', 'activeChatRooms', 'activeSpaces24h', 'chatRoomsTotal', 'articles', 'publicPages', 'openReports']))
    expect(st.articles.published).toBeGreaterThan(0)
  })

  it('site settings: public subset hides legal markdown and renders legal html', async () => {
    expect((await call(s, 'PUT', '/api/admin/site-settings', { site_name: 'Acme Sync', privacy_md: '# Privacy\n\n<script>x</script>ok', unknown_key: 'x' })).status).toBe(400)
    expect((await call(s, 'PUT', '/api/admin/site-settings', { site_name: 'Acme Sync', privacy_md: '# Privacy\n\n<script>x</script>ok' })).status).toBe(200)
    const site = (await pub('/api/site')).body
    expect(site.site_name).toBe('Acme Sync'); expect(site.privacy_md).toBeUndefined(); expect(site.privacy_html).toContain('<h1>Privacy</h1>'); expect(site.privacy_html).not.toContain('<script')
  })
})
