# Sync

Instant text and file sharing between devices on the same network, with device linking, public pages and an end-to-end encrypted private chat. Installable as a PWA, mobile first.

Specs live in `docs/` (`00-MASTER.md`, `01-FEATURES.md`, `02-ARCHITECTURE.md`).

## What is built

| Area | Status |
|---|---|
| Network space by hashed IP, device cookie, presence | done |
| Live text sync, saved state, URLs panel, copy/download/clear | done |
| P2P file sharing: block hashing, resumable multi-source download, OPFS storage, zip, preview | done |
| Device linking: 8 character code, QR (show and scan), share link, IP link, unlink | done |
| Settings (theme, font, URLs panel, auto-download, spellcheck, ads toggle stored) | done |
| Public pages (markdown, sanitized, edit token, reports, view counter) | done |
| Secure chat: password rooms, max 4, E2EE, no history for joiners, wipe when empty, resume | done |
| PWA: manifest, icons, service worker, offline shell, share target | done |
| Blog: articles, categories, tags, scheduling, search, SEO (JSON-LD, sitemap, robots, RSS), instant cache purge | done |
| Media library: webp variants (480/960/1600), alt text, delete protection | done |
| Admin panel: login with lockout and optional TOTP 2FA, CSRF, article editor with live preview, taxonomy, media, reports moderation, ad slots, site settings, admins, audit log, dashboard counts | done |
| Ads: slots managed in admin, rendered only when enabled site-wide and not hidden by the visitor, never in chat | done |

Deviations from the spec: plain SQL migrations instead of Drizzle, Node 22 instead of 24.

## Run locally

Needs Node 22+, pnpm 10, PostgreSQL and Redis (`docker compose -f deploy/dev/docker-compose.yml up -d`).

```
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev                       # api :4000, realtime :4001, web :3000
cd admin && pnpm dev           # admin panel :5173 (first owner comes from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD in .env)
```
Set `NUXT_PUBLIC_RT_URL=http://localhost:4001` for the web process in development so the browser talks to the realtime port directly.

## Tests

```
pnpm --filter @sync/backend test          # integration: real PostgreSQL + Redis (DB sync_test, redis db 1)
pnpm --filter @sync/frontend test         # transfer engine with simulated peers, crypto, helpers
cd frontend && npx playwright test --project=desktop --project=mobile --project=admin   # e2e: real browsers, WebRTC, chat, blog + admin flows (needs `pnpm dev` and the admin dev server running)
E2E_BASE_URL=http://localhost:3100 npx playwright test --project=pwa   # against `nuxt build` + preview
```

## Deploy (single VPS)

`pnpm build`, `pnpm db:migrate`, then `pm2 start deploy/ecosystem.config.cjs` behind `deploy/nginx.conf`. Back up PostgreSQL with `pg_dump`. Redis needs no persistence (`save ""`, `appendonly no`). Build the admin with `pnpm --filter @sync/admin build` and serve `admin/dist` on the admin host. Set `NUXT_INTERNAL_URL` and `REVALIDATE_SECRET` (same value for the API and the web process) so publishing purges cached pages at once. Set real `MASTER_KEY`, `IP_PEPPER`, `COOKIE_SECRET` (64 hex chars each) in `.env`.
