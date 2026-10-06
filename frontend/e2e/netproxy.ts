import http from 'node:http'
import type { AddressInfo } from 'node:net'
import httpProxy from 'http-proxy'

const API = 'http://127.0.0.1:4000', RT = 'http://127.0.0.1:4001', WEB = process.env.E2E_NET_WEB ?? 'http://127.0.0.1:3000'

export interface Network { ip: string; url: string; close: () => Promise<void> }

/**
 * One simulated network: its own origin whose traffic reaches the real servers stamped with a public IP.
 * Page and API requests and the realtime websocket all pass through, so the app sees a different network per browser.
 */
export async function startNetwork(ip: string): Promise<Network> {
  const proxy = httpProxy.createProxyServer({ xfwd: false })
  proxy.on('error', (_e, _req, res) => { if (res instanceof http.ServerResponse && !res.headersSent) { res.writeHead(502); res.end('bad gateway') } })
  const pick = (url = ''): string => (url.startsWith('/api') || url.startsWith('/media') ? API : url.startsWith('/socket.io') ? RT : WEB)
  const stamp = (req: http.IncomingMessage): void => { req.headers['x-forwarded-for'] = ip }
  const server = http.createServer((req, res) => { stamp(req); proxy.web(req, res, { target: pick(req.url) }) })
  server.on('upgrade', (req, socket, head) => { stamp(req); proxy.ws(req, socket, head, { target: pick(req.url) }) })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as AddressInfo).port
  return { ip, url: `http://localhost:${port}`, close: () => new Promise(r => { server.closeAllConnections(); server.close(() => r()) }) }
}

let n = 0
/** A unique public-looking IP per call. */
export const publicIp = (): string => `${50 + (n++ % 150)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
