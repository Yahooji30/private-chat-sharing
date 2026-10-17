// Production server for the admin panel: serves the built files in dist/ and forwards /api and /media to the backend.
// Configure with admin/.env (PORT, HOST, ADMIN_API_URL, TRUST_PROXY). Run: pnpm build && pnpm start
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import http from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import httpProxy from 'http-proxy'

const port = Number(process.env.PORT ?? 5173)
// 0.0.0.0 = every network (as before). 127.0.0.1 = only nginx on this machine can reach the panel (recommended behind nginx).
const host = process.env.HOST ?? '0.0.0.0'
// true (as before): believe the X-Forwarded-For that nginx sends. false: always use the connection's own address.
const trustForwarded = (process.env.TRUST_PROXY ?? 'true').trim().toLowerCase() !== 'false'
const api = process.env.ADMIN_API_URL ?? 'http://127.0.0.1:4000'
const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const proxy = httpProxy.createProxyServer({ target: api, xfwd: false })
proxy.on('error', (_e, _req, res) => { if (res instanceof http.ServerResponse && !res.headersSent) { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":{"code":"INTERNAL","message":"Cannot reach the backend"}}') } })

// The page has one small inline script (it sets the dark theme before the first paint). It is allowed by its hash, read from the built page,
// so everything else inline stays blocked and a rebuild never needs a manual change.
const indexHtml = existsSync(join(root, 'index.html')) ? readFileSync(join(root, 'index.html'), 'utf8') : ''
const inlineHashes = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
const security = {
  'content-security-policy': ["default-src 'self'", `script-src 'self' ${inlineHashes.join(' ')}`.trim(), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:", "connect-src 'self'",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; '),
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
  // only has an effect over https: browsers ignore it on plain http
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
}

http.createServer((req, res) => {
  for (const [k, v] of Object.entries(security)) res.setHeader(k, v)
  const url = (req.url ?? '/').split('?')[0] ?? '/'
  if (url.startsWith('/api') || url.startsWith('/media')) {
    const own = req.socket.remoteAddress ?? ''
    req.headers['x-forwarded-for'] = trustForwarded ? (req.headers['x-forwarded-for'] ?? own) : own
    return proxy.web(req, res)
  }
  let file = join(root, normalize(url).replace(/^(\.\.[/\\])+/, ''))
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': file.includes('assets') ? 'public, max-age=31536000, immutable' : 'no-cache', 'x-robots-tag': 'noindex, nofollow' })
  createReadStream(file).pipe(res)
}).listen(port, host, () => console.log(`admin on http://${host === '0.0.0.0' ? 'localhost' : host}:${port} (backend ${api})`))
