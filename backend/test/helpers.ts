import type { AddressInfo } from 'node:net'
import { io as ioc, type Socket } from 'socket.io-client'
import { buildApi } from '../src/api/server'
import { buildRt } from '../src/rt/server'

export interface Client { ip: string; cookie: string }
export const client = (ip: string, id: string): Client => ({ ip, cookie: `sid_dev=${id.padEnd(32, '0')}` })

export async function boot() {
  const api = await buildApi()
  const rt = await buildRt()
  await new Promise<void>(r => rt.http.listen(0, r))
  const url = `http://127.0.0.1:${(rt.http.address() as AddressInfo).port}`
  const call = async (c: Client, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await api.inject({ method, url: path, headers: { cookie: c.cookie, 'x-forwarded-for': c.ip, ...headers }, ...(body === undefined ? {} : { payload: body as object }) })
    return { status: res.statusCode, body: res.json() as Record<string, any> }
  }
  const sock = (c: Client, ns: '/space' | '/chat', auth?: object): Socket =>
    ioc(url + ns, { transports: ['websocket'], extraHeaders: { cookie: c.cookie, 'x-forwarded-for': c.ip }, auth, reconnection: false, forceNew: true })
  const close = async () => { await rt.close(); await api.close() }
  return { api, rt, call, sock, close }
}

export const connected = (s: Socket): Promise<Socket> => new Promise((res, rej) => { s.once('connect', () => res(s)); s.once('connect_error', rej) })
export const once = <T = any>(s: Socket, ev: string, ms = 3000): Promise<T> =>
  new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout ${ev}`)), ms); s.once(ev, (v: T) => { clearTimeout(t); res(v) }) })
export const emitAck = <T = any>(s: Socket, ev: string, data: unknown): Promise<T> => s.timeout(3000).emitWithAck(ev, data) as Promise<T>
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
