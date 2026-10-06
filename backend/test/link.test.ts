import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { boot, client, connected, emitAck, once } from './helpers'

let t: Awaited<ReturnType<typeof boot>>
beforeAll(async () => { t = await boot() })
afterAll(async () => { await t.close() })

const A = client('1.1.1.1', 'aaaaaaaaaaaaaaaa')
const P = client('100.200.1.5', 'pppppppppppppppp')

describe('device linking', () => {
  it('links a phone on another network by single-use code and shares text', async () => {
    const s = await connected(t.sock(A, '/space'))
    await emitAck(s, 'text:update', { content: 'from laptop', baseRev: 0 })
    const gen = await t.call(A, 'POST', '/api/link/code')
    expect(gen.body.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    expect(gen.body.url).toContain('/link?c=')
    expect((await t.call(P, 'GET', '/api/text')).body.content).toBe('')
    const joined = once(s, 'link:joined')
    expect((await t.call(P, 'POST', '/api/link/redeem', { code: gen.body.code.toLowerCase() })).status).toBe(200)
    await joined
    expect((await t.call(P, 'GET', '/api/text')).body.content).toBe('from laptop')
    const again = await t.call(client('5.5.5.5', 'zzzzzzzzzzzzzzzz'), 'POST', '/api/link/redeem', { code: gen.body.code })
    expect(again.status).toBe(400)
    expect(again.body.error.code).toBe('LINK_INVALID')
    s.close()
  })

  it('lists, then unlinks a device which falls back to its own network', async () => {
    const list = await t.call(A, 'GET', '/api/link/list')
    expect(list.body.devices).toHaveLength(1)
    const pid = list.body.devices[0].id
    const ps = await connected(t.sock(P, '/space'))
    const closed = once(ps, 'disconnect')
    expect((await t.call(A, 'DELETE', `/api/link/device/${pid}`)).status).toBe(200)
    await closed
    expect((await t.call(P, 'GET', '/api/text')).body.content).toBe('')
    expect((await t.call(A, 'DELETE', `/api/link/device/${pid}`)).status).toBe(404)
  })

  it('limits active codes and rejects garbage codes', async () => {
    const X = client('2.2.2.2', 'xxxxxxxxxxxxxxxx')
    for (let i = 0; i < 3; i++) expect((await t.call(X, 'POST', '/api/link/code')).status).toBe(200)
    expect((await t.call(X, 'POST', '/api/link/code')).body.error.code).toBe('LINK_LIMIT')
    expect((await t.call(X, 'POST', '/api/link/redeem', { code: 'nope' })).status).toBe(400)
  })

  it('links a network by IP, rejects private IPs, and can unlink it', async () => {
    const owner = client('3.3.3.3', 'oooooooooooooooo'), other = client('4.4.4.4', 'tttttttttttttttt')
    expect((await t.call(owner, 'POST', '/api/link/ip', { ip: '192.168.1.5' })).body.error.code).toBe('IP_INVALID')
    expect((await t.call(owner, 'POST', '/api/link/ip', { ip: 'abc' })).status).toBe(400)
    expect((await t.call(owner, 'GET', '/api/link/check?ip=4.4.4.4')).body.linked).toBe(false)
    await t.api.redis.set('x', '1')
    const s = await connected(t.sock(owner, '/space'))
    await emitAck(s, 'text:update', { content: 'shared via ip', baseRev: 0 })
    expect((await t.call(other, 'GET', '/api/text')).body.content).toBe('')
    expect((await t.call(owner, 'POST', '/api/link/ip', { ip: '4.4.4.4' })).status).toBe(200)
    expect((await t.call(owner, 'GET', '/api/link/check?ip=4.4.4.4')).body.linked).toBe(true)
    expect((await t.call(other, 'GET', '/api/text')).body.content).toBe('shared via ip')
    const nets = (await t.call(owner, 'GET', '/api/link/list')).body.networks
    expect(nets[0].label).toBe('Network #1')
    expect((await t.call(owner, 'DELETE', `/api/link/ip/${nets[0].id}`)).status).toBe(200)
    expect((await t.call(other, 'GET', '/api/text')).body.content).toBe('')
    s.close()
  })
})
