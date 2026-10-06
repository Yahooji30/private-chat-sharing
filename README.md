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
| Ads slots, blog and admin panel | not yet (layout leaves `#ad-top-banner` and `#ad-footer` mount points) |

Deviations from the spec: plain SQL migrations instead of Drizzle, Node 22 instead of 24.

## Run locally

Needs Node 22+, pnpm 10, PostgreSQL and Redis (`docker compose -f deploy/dev/docker-compose.yml up -d`).

```
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev                       # api :4000, realtime :4001, web :3000
```
Set `NUXT_PUBLIC_RT_URL=http://localhost:4001` for the web process in development so the browser talks to the realtime port directly.

## Tests

```
pnpm --filter @sync/backend test          # integration: real PostgreSQL + Redis (DB sync_test, redis db 1)
pnpm --filter @sync/frontend test         # transfer engine with simulated peers, crypto, helpers
cd frontend && npx playwright test        # e2e: two real browsers, WebRTC transfer, chat, mobile layout
E2E_BASE_URL=http://localhost:3100 npx playwright test --project=pwa   # against `nuxt build` + preview
```

## Deploy (single VPS)

`pnpm build`, `pnpm db:migrate`, then `pm2 start deploy/ecosystem.config.cjs` behind `deploy/nginx.conf`. Back up PostgreSQL with `pg_dump`. Redis needs no persistence (`save ""`, `appendonly no`). Set real `MASTER_KEY`, `IP_PEPPER`, `COOKIE_SECRET` (64 hex chars each) in `.env`.
