// Load test for the realtime service. Usage: node scripts/loadtest.mjs [spaces=100] [devicesPerSpace=3] [chatRooms=40]
// Needs the API (API_URL, default http://127.0.0.1:4010) and realtime (RT_URL, default http://127.0.0.1:4011) running.
import { randomBytes } from 'node:crypto'
import { io } from 'socket.io-client'

const API = process.env.API_URL ?? 'http://127.0.0.1:4010', RT = process.env.RT_URL ?? 'http://127.0.0.1:4011'
const SPACES = Number(process.argv[2] ?? 100), PER = Number(process.argv[3] ?? 3), ROOMS = Number(process.argv[4] ?? 40)
const ip = (a, b) => `${60 + (a % 150)}.${b % 250}.${(a * 7) % 250}.${1 + ((a + b) % 250)}`
const pct = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const api = (path, ipAddr, body) => fetch(API + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-forwarded-for': ipAddr }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json() }))
const connect = (ns, ipAddr, cookie, auth) => new Promise((res, rej) => {
  const s = io(RT + ns, { transports: ['websocket'], extraHeaders: { cookie: `sid_dev=${cookie}`, 'x-forwarded-for': ipAddr }, auth, reconnection: false, forceNew: true })
  s.once('connect', () => res(s)); s.once('connect_error', rej)
})

const t0 = Date.now()
const errors = []
const textLat = [], chatLat = []

// ---- text sync: SPACES networks, PER devices each; one writer per space sends 20 updates
const spaces = await Promise.all(Array.from({ length: SPACES }, async (_, i) => {
  const addr = ip(i, 1)
  const socks = await Promise.all(Array.from({ length: PER }, (_, d) => connect('/space', addr, randomBytes(12).toString('hex') + String(d))))
  for (const s of socks.slice(1)) s.on('text:changed', m => { const sent = Number(String(m.content).split('|')[0]); if (sent) textLat.push(Date.now() - sent) })
  return socks
})).catch(e => { errors.push(`connect: ${e.message}`); return [] })
const connectedMs = Date.now() - t0
console.log(`connected ${spaces.flat().length} sockets in ${connectedMs} ms`)
await Promise.all(spaces.map(async socks => {
  for (let k = 0; k < 20; k++) {
    const r = await socks[0].timeout(5000).emitWithAck('text:update', { content: `${Date.now()}|${'x'.repeat(2000)}`, baseRev: 0 }).catch(e => ({ error: e.message }))
    if (r.error) errors.push(`text: ${r.error}`)
    await sleep(120 + Math.random() * 80)
  }
}))
await sleep(500)

// ---- chat: ROOMS rooms of 4, each member sends 10 ciphertext messages
const chatT = Date.now()
const rooms = await Promise.all(Array.from({ length: ROOMS }, async (_, r) => {
  const addr = ip(r + 500, 9), authKey = randomBytes(32).toString('base64'), code = `LOAD${r}${randomBytes(2).toString('hex')}`.toUpperCase()
  const c = await api('/api/chat/rooms', addr, { code, authKey, kdfSalt: randomBytes(16).toString('base64') })
  if (c.status !== 200) { errors.push(`room: ${c.status}`); return [] }
  const members = []
  for (let m = 0; m < 4; m++) {
    const t = await api(`/api/chat/rooms/${code}/ticket`, ip(r + 500, m + 20), { authKey })
    const s = await connect('/chat', ip(r + 500, m + 20), randomBytes(12).toString('hex') + m, { ticket: t.body.ticket }).catch(e => { errors.push(`join: ${e.message}`); return null })
    if (s) { s.on('chat:msg', msg => { const sent = Number(Buffer.from(msg.ct, 'base64').toString().split('|')[0]); if (sent) chatLat.push(Date.now() - sent) }); members.push(s) }
  }
  return members
}))
await Promise.all(rooms.map(async members => {
  for (let k = 0; k < 10; k++) for (const s of members) {
    const ct = Buffer.from(`${Date.now()}|${'y'.repeat(300)}`).toString('base64')
    const r = await s.timeout(5000).emitWithAck('chat:msg', { iv: 'aXZpdml2aXZpdml2', ct }).catch(e => ({ error: e.message }))
    if (r.error) errors.push(`chat: ${r.error}`)
    await sleep(220)
  }
}))
await sleep(500)
const health = await api('/api/health', '1.2.3.4')

console.log(`text relay  n=${textLat.length} p50=${pct(textLat, .5)}ms p95=${pct(textLat, .95)}ms p99=${pct(textLat, .99)}ms max=${Math.max(...textLat)}ms`)
console.log(`chat relay  n=${chatLat.length} p50=${pct(chatLat, .5)}ms p95=${pct(chatLat, .95)}ms p99=${pct(chatLat, .99)}ms max=${Math.max(...chatLat)}ms (${Date.now() - chatT} ms)`)
console.log(`api health  ${JSON.stringify(health.body)}`)
console.log(`errors      ${errors.length}${errors.length ? ' e.g. ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''}`)
for (const s of [...spaces.flat(), ...rooms.flat()]) s.close()
process.exit(errors.length ? 1 : 0)
