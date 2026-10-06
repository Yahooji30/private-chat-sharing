// Production server for the admin panel: serves the built files in dist/ and forwards /api and /media to the backend.
// Configure with admin/.env (PORT, ADMIN_API_URL). Run: pnpm build && pnpm start
import { createReadStream, existsSync, statSync } from 'node:fs'
import http from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import httpProxy from 'http-proxy'

const port = Number(process.env.PORT ?? 5173)
const api = process.env.ADMIN_API_URL ?? 'http://127.0.0.1:4000'
const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const proxy = httpProxy.createProxyServer({ target: api, xfwd: false })
proxy.on('error', (_e, _req, res) => { if (res instanceof http.ServerResponse && !res.headersSent) { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":{"code":"INTERNAL","message":"Cannot reach the backend"}}') } })

http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0] ?? '/'
  if (url.startsWith('/api') || url.startsWith('/media')) {
    req.headers['x-forwarded-for'] = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? ''
    return proxy.web(req, res)
  }
  let file = join(root, normalize(url).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': file.includes('assets') ? 'public, max-age=31536000, immutable' : 'no-cache', 'x-robots-tag': 'noindex, nofollow' })
  createReadStream(file).pipe(res)
}).listen(port, '0.0.0.0', () => console.log(`admin on http://localhost:${port} (backend ${api})`))
