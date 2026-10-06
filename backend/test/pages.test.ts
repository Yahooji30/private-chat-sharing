import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { boot, client } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

const O = client('11.1.1.1', 'oooooooooooooooo'), V = client('12.2.2.2', 'vvvvvvvvvvvvvvvv')

describe('public pages', () => {
  it('publishes sanitized markdown, counts unique views, and enforces ownership', async () => {
    const c = await t.call(O, 'POST', '/api/public-pages', { title: 'Hello', body: '# Hi\n<script>alert(1)</script> [x](javascript:alert(1)) **b**', slug: 'hello-page' })
    expect(c.status).toBe(200)
    const p = await t.call(V, 'GET', '/api/p/hello-page')
    expect(p.body.html).toContain('<h1>Hi</h1>')
    expect(p.body.html).not.toContain('<script')
    expect(p.body.html).not.toMatch(/href=.?javascript/)
    expect(p.body.indexable).toBe(false)
    expect((await t.call(V, 'GET', '/api/p/hello-page')).body.views).toBe(1)
    expect((await t.call(V, 'PUT', '/api/public-pages/hello-page', { title: 'x' })).status).toBe(403)
    expect((await t.call(V, 'PUT', '/api/public-pages/hello-page', { title: 'Edited' }, { 'x-edit-token': c.body.editToken })).status).toBe(200)
    expect((await t.call(O, 'GET', '/api/public-pages')).body[0].title).toBe('Edited')
    expect((await t.call(O, 'POST', '/api/public-pages', { title: 'dup', body: 'x', slug: 'hello-page' })).body.error.code).toBe('SLUG_TAKEN')
    expect((await t.call(V, 'POST', '/api/p/hello-page/report', { reason: 'spam page' })).status).toBe(200)
    expect((await t.call(O, 'DELETE', '/api/public-pages/hello-page')).status).toBe(200)
    expect((await t.call(V, 'GET', '/api/p/hello-page')).status).toBe(404)
  })

  it('validates input and rate limits creation', async () => {
    expect((await t.call(O, 'POST', '/api/public-pages', { title: '', body: 'x' })).status).toBe(400)
    expect((await t.call(O, 'POST', '/api/public-pages', { title: 'a', body: 'x', slug: 'A_B' })).status).toBe(400)
    let last = 200
    for (let i = 0; i < 11; i++) last = (await t.call(O, 'POST', '/api/public-pages', { title: 't', body: 'b' })).status
    expect(last).toBe(429)
  })
})
