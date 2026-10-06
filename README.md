# Sync

Instant text and file sharing between devices on the same network, with device linking (code, QR, IP), public pages, an end-to-end encrypted private chat, a blog and an admin panel. Mobile first and installable as a PWA.

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
pm2 start deploy/ecosystem.local.cjs
```
Open http://localhost:3000. For the admin panel run `pnpm --filter @sync/admin dev` (http://localhost:5173). `pm2 logs`, `pm2 stop all`, `pm2 delete all` manage the processes.

## Tests

```
pnpm check                                  # typecheck all packages + backend integration + frontend unit tests
cd frontend
npx playwright test --project=desktop --project=mobile --project=admin   # needs `pnpm dev` and the admin dev server
npx playwright test --project=net           # multi-network e2e, needs `pnpm build` and the web build served on :3100 (below)
E2E_BASE_URL=http://localhost:3100 npx playwright test --project=pwa     # service worker and offline, same build
node backend/scripts/loadtest.mjs 800 3 100 # realtime load test against a production-mode API/RT (see the script header)
```
- Backend integration tests run against real PostgreSQL (`sync_test`) and Redis (db 1): access control on every admin route, sealed data at rest, no raw IPs, rate limits, socket flood, concurrent chat joins, linking, blog, media, admin.
- Frontend unit tests cover the transfer engine with simulated peers (corrupt peer, dropped peer, resume), chat crypto and helpers.
- The `net` project puts each browser behind its own simulated public IP (`frontend/e2e/netproxy.ts`) so the app really sees different networks: isolation, link by code, QR scan with a fake camera, link by IP, unlink, files and chat across networks, connection loss and resume, CSP.

Serve the production web build for the `net` and `pwa` projects: `pnpm build && (cd frontend && PORT=3100 node .output/server/index.mjs)` with the API and realtime services running. Always use `pnpm build` (it cleans stale output).

## Deploy (single VPS)

1. `pnpm build`, `pnpm db:migrate`.
2. `pm2 start deploy/ecosystem.config.cjs` behind `deploy/nginx.conf` (public site, `/api`, `/socket.io`, `/media`, and the admin host serving `admin/dist`).
3. Back up PostgreSQL with `deploy/backup.sh` (cron). Redis needs no persistence (`save ""`, `appendonly no`).
4. `.env`: real `MASTER_KEY`, `IP_PEPPER`, `COOKIE_SECRET` (64 hex chars each), `NUXT_PUBLIC_SITE_URL`, and `REVALIDATE_SECRET` for the API with `NUXT_INTERNAL_URL` (comma separated web URLs) so publishing purges cached pages at once. The web process reads the same secret as `NUXT_REVALIDATE_SECRET` (the PM2 file maps it). To share the page cache between PM2 web workers, run `pnpm build` with `NUXT_CACHE_REDIS_URL` set (for example `redis://127.0.0.1:6379/2`) and keep it set when starting.
5. The `/api/dev/*` endpoints only exist outside production.

## Measured

- Lighthouse (mobile, throttled, production build): performance 95 to 96, accessibility 100, SEO 100 on `/` and `/blog` (`/chat` is intentionally `noindex`). No layout shift.
- Load test, production-mode services: 2400 sockets in 800 spaces plus 100 chat rooms of 4, zero errors; text relay p99 141 ms, chat relay p99 13 ms; realtime process 331 MB RSS.
- `pnpm audit --prod`: two advisories remain (`braces`, `node-forge`), both inside Nuxt's build and dev tooling chain with no patched release; they are not part of the runtime server bundle.

## Known limits

- Mobile coverage is Chromium device emulation. iOS Safari and real phones were not available for testing.
- Peer to peer across strict NATs needs a TURN relay (`TURN_ENABLED`, coturn); it is off by default.
- Devices behind the same public IP share a space, including on public Wi-Fi and mobile carriers.
