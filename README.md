# Sync

Instant text and file sharing between devices on the same network, with device linking (code, QR, IP), public pages, an end-to-end encrypted private chat, a blog and an admin panel. Mobile first and installable as a PWA.

## Apps

| Folder | What | Port | Rendering |
|---|---|---|---|
| `frontend/` | The app: text, files, linking, chat, public page editor, settings | 3000 | SPA (no server rendering) |
| `blog/` | Blog, public pages (`/p/<slug>`), privacy and terms, sitemap, RSS | 3001 | SSR for SEO |
| `admin/` | Admin panel | 5173 (dev) | SPA, static build |
| `backend/` | API (4000) and realtime (4001) | | |

The app links out to the blog site. Its address comes from `BLOG_PUBLIC_URL` in `.env`, and the realtime address from `RT_PUBLIC_URL`.

Specs live in `docs/` (`00-MASTER.md`, `01-FEATURES.md`, `02-ARCHITECTURE.md`).

## What is in it

| Area | Notes |
|---|---|
| Network space | A space per public IP (hashed, never stored raw), device cookie, presence list with device names |
| Live text | Real-time sync, saved state, offline queue, last write wins, URLs panel, copy/download/clear |
| Files | Peer to peer over WebRTC, 1 MiB blocks hashed and verified, multi-source, resumable after reload, OPFS storage, preview, zip all. Nothing is stored on the server |
| Linking | 8 character code, QR (show and camera scan), share link, IP address; linked devices list, unlink. Online devices are moved into the new space at once |
| Secure chat | Password rooms, max 4, E2EE (PBKDF2 + AES-GCM in the browser), ciphertext only in Redis, no history for joiners, wiped when empty, resume after a drop |
| Public pages | Markdown, sanitized, edit token, reports, view counter |
| Blog | Articles, categories, tags, scheduling, search, SEO (JSON-LD, sitemap, robots, RSS), cache purge on publish |
| Admin | Sign in with lockout and optional 2FA, CSRF, article editor with live preview, media library, taxonomy, moderation, legal text and site settings, admins, audit log, dashboard counts |
| PWA | Manifest, icons, service worker, offline shell, share target |
| Ads | Not part of this module. The home page keeps `#ad-top-banner`, the layout `#ad-footer`, and the per-space "hide ads" setting is stored |

Deviations from the docs: plain SQL migrations instead of Drizzle, Node 22 instead of 24, admin Media page at `/library` (because `/media` serves images).

## Run locally

Needs Node 22+, pnpm 10, PostgreSQL and Redis (`docker compose -f deploy/dev/docker-compose.yml up -d`).

```
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev                       # api :4000, realtime :4001, web :3000
cd admin && pnpm dev           # admin :5173; first owner = ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD from .env
```
Run the web process with `NUXT_PUBLIC_RT_URL=http://localhost:4001` in development so the browser reaches the realtime port directly. Change the bootstrap password before any real deployment.

## Run on one PC with pm2 (no nginx)

```
docker compose -f deploy/dev/docker-compose.yml up -d     # PostgreSQL + Redis
copy .env.example .env                                     # Windows (use cp on Mac/Linux)
pnpm install
pnpm db:migrate
pnpm build
pnpm add -g pm2
pm2 start deploy/ecosystem.local.config.cjs
```
Open http://localhost:3000 (app) and http://localhost:3001 (blog). `.env` must contain `RT_PUBLIC_URL=http://localhost:4001` and `BLOG_PUBLIC_URL=http://localhost:3001` (the defaults in `.env.example`); leave `RT_PUBLIC_URL` empty when everything sits behind nginx. For the admin panel run `pnpm --filter @sync/admin dev` (http://localhost:5173). `pm2 logs`, `pm2 stop all`, `pm2 delete all` manage the processes.

## Tests

```
pnpm check                                  # typecheck all packages + backend integration + frontend unit tests
cd frontend
npx playwright test --project=desktop --project=mobile --project=admin   # needs `pnpm dev` and the admin dev server
E2E_BASE_URL=http://localhost:3000 npx playwright test --project=net --project=pwa   # against the built stack (pm2 run above); start the API with RT_PUBLIC_URL= (empty) for the net project so sockets go through the test proxy
node backend/scripts/loadtest.mjs 800 3 100 # realtime load test against a production-mode API/RT (see the script header)
```
- Backend integration tests run against real PostgreSQL (`sync_test`) and Redis (db 1): access control on every admin route, sealed data at rest, no raw IPs, rate limits, socket flood, concurrent chat joins, linking, blog, media, admin.
- Frontend unit tests cover the transfer engine with simulated peers (corrupt peer, dropped peer, resume), chat crypto and helpers.
- The `net` project puts each browser behind its own simulated public IP (`frontend/e2e/netproxy.ts`) so the app really sees different networks: isolation, link by code, QR scan with a fake camera, link by IP, unlink, files and chat across networks, connection loss and resume, CSP.

The `net` and `pwa` projects run against the built stack (`pnpm build` then the pm2 steps above). Always use `pnpm build`, it cleans stale output.

## Deploy (single VPS)

1. `pnpm build`, `pnpm db:migrate`.
2. `pm2 start deploy/ecosystem.config.cjs` behind `deploy/nginx.conf`: the app host (`/`, `/api`, `/socket.io`), a blog host (blog site and `/media`), and an admin host serving `admin/dist`.
3. Back up PostgreSQL with `deploy/backup.sh` (cron). Redis needs no persistence (`save ""`, `appendonly no`).
4. `.env`: real `MASTER_KEY`, `IP_PEPPER`, `COOKIE_SECRET` (64 hex chars each), `PUBLIC_ORIGIN` (the app address), `BLOG_PUBLIC_URL` (the blog address), `RT_PUBLIC_URL` (empty behind nginx), and `REVALIDATE_SECRET` with `NUXT_INTERNAL_URL` (the blog's internal URL, comma separated for several) so publishing purges the blog's cached pages at once. The PM2 file passes the secret and addresses to the blog process. The blog caches in memory per worker, so a purge reaches the worker that receives it; run one blog worker, or accept a short delay on the others.
5. The `/api/dev/*` endpoints only exist outside production.

## Measured

- Lighthouse (mobile, throttled, production build): performance 95 to 96, accessibility 100, SEO 100 on `/` and `/blog` (`/chat` is intentionally `noindex`). No layout shift.
- Load test, production-mode services: 2400 sockets in 800 spaces plus 100 chat rooms of 4, zero errors; text relay p99 141 ms, chat relay p99 13 ms; realtime process 331 MB RSS.
- `pnpm audit --prod`: two advisories remain (`braces`, `node-forge`), both inside Nuxt's build and dev tooling chain with no patched release; they are not part of the runtime server bundle.

## Known limits

- Mobile coverage is Chromium device emulation. iOS Safari and real phones were not available for testing.
- Peer to peer across strict NATs needs a TURN relay (`TURN_ENABLED`, coturn); it is off by default.
- Devices behind the same public IP share a space, including on public Wi-Fi and mobile carriers.
