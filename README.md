# Sync

Instant text and file sharing between devices on the same network, with device linking (code, QR, IP), public pages, an end-to-end encrypted private chat, a blog and an admin panel. Mobile first and installable as a PWA.

## Apps

| Folder | What | Port | Rendering |
|---|---|---|---|
| `frontend/` | The app: text, files, linking, chat, public page editor, settings | 3000 | SPA (no server rendering) |
| `blog/` | Blog, features, FAQ, feedback, public pages (`/p/<slug>`), privacy and terms, sitemap, RSS | 3001 | SSR for SEO |
| `admin/` | Admin panel | 5173 (dev) | SPA, static build |
| `backend/` | API (4000) and realtime (4001) | | |

Each app has its own `.env.example`, `ecosystem.config.cjs` and start script.

The app links out to the blog site (`NUXT_PUBLIC_BLOG_URL` in `frontend/.env`) and reaches realtime at `NUXT_PUBLIC_RT_URL`.

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
| Admin | Sign in with lockout and optional 2FA, CSRF, article editor with live preview, media library, taxonomy, moderation, legal text and site settings, admins, audit log, dashboard counts, plus the FAQ, feedback and SEO managers below |
| FAQ | `/faq` on the blog site. Questions are written in the admin (Markdown answers, groups, ordering with up and down buttons, hide or show). Rendered on the server with `FAQPage` structured data |
| Features | `/features` on the blog site: what the product does, with `WebApplication` structured data |
| Feedback | `/feedback` form (star rating, message, optional name and email; honeypot and 5 per hour per network). Admin inbox with new/read/archived, average rating, and a per-message switch to show it publicly (name, rating and message only, never the email) |
| SEO per page | Admin > SEO edits title, description, keywords, social title/description/image, canonical and noindex for the app home and secure chat pages and for the blog, features, FAQ, feedback, privacy and terms pages. The blog site renders them on the server; the app injects them into its first HTML (`frontend/server/plugins/seo.ts`) so crawlers and link previews see them. Noindex pages leave the sitemap. Articles keep their own SEO fields |
| Chat invite message | The Invite sheet in a chat room sends a ready-made message with the room link through WhatsApp, Telegram, email, SMS, the phone's share sheet or copy. Wording is editable in Admin > Site settings (`{link}` marks where the link goes); the default is "I have sent you a secret message. Please click on this link, use the password ** and read the message." The password is never part of it |
| PWA | Manifest, icons, service worker, offline shell, share target |
| Ads | Not part of this module. The home page keeps `#ad-top-banner`, the layout `#ad-footer`, and the per-space "hide ads" setting is stored |

Deviations from the docs: plain SQL migrations instead of Drizzle, Node 22 instead of 24, admin Media page at `/library` (because `/media` serves images).

## Run locally

Needs Node 22+, pnpm 10, PostgreSQL and Redis (`docker compose -f deploy/dev/docker-compose.yml up -d`).

Every app is independent: it has its own `.env`, builds on its own and starts on its own. Nothing reads a shared `.env`.

```
pnpm install                                   # once, at the repo root
docker compose -f deploy/dev/docker-compose.yml up -d

# 1. backend (API :4000 + realtime :4001)
cd backend
copy .env.example .env                         # cp on Mac/Linux; edit if needed
pnpm db:migrate
pnpm build
pm2 start ecosystem.config.cjs                 # or: pnpm start:api  and  pnpm start:rt  (two terminals)

# 2. app (:3000)           3. blog (:3001)           4. admin (:5173)
cd ../frontend               cd ../blog                cd ../admin
copy .env.example .env       copy .env.example .env    copy .env.example .env
pnpm build                   pnpm build                pnpm build
pm2 start ecosystem.config.cjs   (same)                (same)
```
Open http://localhost:3000 (app), http://localhost:3001 (blog, public pages, legal), http://localhost:5173 (admin, first login from `ADMIN_BOOTSTRAP_*` in `backend/.env`; change that password).

Each folder also has `pnpm dev` for development. Without pm2 use `pnpm start` in each folder (it loads that folder's `.env`). `pm2 logs`, `pm2 status`, `pm2 delete all` manage the processes. From the repo root, `pm2 start deploy/ecosystem.local.config.cjs` starts all five at once (each still with its own folder and `.env`).

The built servers contain all their dependencies (no `node_modules` is needed to run `frontend/.output` and `blog/.output`). The app and blog read `NUXT_*` settings from their own `.env` when you build and when you start, so keep the same values for both.

## Tests

```
pnpm check                                  # typecheck all packages + backend integration + frontend unit tests
cd frontend
npx playwright test --project=desktop --project=mobile --project=admin   # needs `pnpm dev` and the admin dev server
E2E_BASE_URL=http://localhost:3000 npx playwright test --project=pwa    # against the built stack
E2E_NET_WEB=http://127.0.0.1:3002 npx playwright test --project=net   # needs a frontend built AND started with NUXT_PUBLIC_RT_URL= (empty), here on PORT=3002, so sockets go through the test proxy
node backend/scripts/loadtest.mjs 800 3 100 # realtime load test against a production-mode API/RT (see the script header)
```
- Backend integration tests run against real PostgreSQL (`sync_test`) and Redis (db 1): access control on every admin route, sealed data at rest, no raw IPs, rate limits, socket flood, concurrent chat joins, linking, blog, media, admin.
- Frontend unit tests cover the transfer engine with simulated peers (corrupt peer, dropped peer, resume), chat crypto and helpers.
- The `net` project puts each browser behind its own simulated public IP (`frontend/e2e/netproxy.ts`) so the app really sees different networks: isolation, link by code, QR scan with a fake camera, link by IP, unlink, files and chat across networks, connection loss and resume, CSP.

The `net` and `pwa` projects run against built apps. Always use `pnpm build`, it cleans stale output.

## Deploy (single VPS)

1. `pnpm build`, `pnpm db:migrate`.
2. `pm2 start deploy/ecosystem.config.cjs` behind `deploy/nginx.conf`: the app host (`/`, `/api`, `/socket.io`), a blog host (blog site and `/media`), and an admin host serving `admin/dist`.
3. Back up PostgreSQL with `deploy/backup.sh` (cron). Redis needs no persistence (`save ""`, `appendonly no`).
4. per-app `.env` files. `backend/.env`: real `MASTER_KEY`, `IP_PEPPER`, `COOKIE_SECRET` (64 hex chars each), `PUBLIC_ORIGIN` (the app address), `REVALIDATE_SECRET` and `NUXT_INTERNAL_URL` (the blog's internal URL) so publishing purges the blog's cached pages at once. `frontend/.env`: `NUXT_PUBLIC_RT_URL` (empty behind nginx) and `NUXT_PUBLIC_BLOG_URL`, then build. `blog/.env`: `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_APP_URL`, and `NUXT_REVALIDATE_SECRET` equal to the backend's secret. `admin/.env`: `ADMIN_API_URL`. The blog caches in memory per worker, so a purge reaches the worker that receives it; run one blog worker, or accept a short delay on the others.
5. The `/api/dev/*` endpoints only exist outside production.

## Measured

- Lighthouse (mobile, throttled, production build): performance 95 to 96, accessibility 100, SEO 100 on `/` and `/blog` (`/chat` is intentionally `noindex`). No layout shift.
- Load test, production-mode services: 2400 sockets in 800 spaces plus 100 chat rooms of 4, zero errors; text relay p99 141 ms, chat relay p99 13 ms; realtime process 331 MB RSS.
- `pnpm audit --prod`: two advisories remain (`braces`, `node-forge`), both inside Nuxt's build and dev tooling chain with no patched release; they are not part of the runtime server bundle.

## Known limits

- Mobile coverage is Chromium device emulation. iOS Safari and real phones were not available for testing.
- Peer to peer across strict NATs needs a TURN relay (`TURN_ENABLED`, coturn); it is off by default.
- Devices behind the same public IP share a space, including on public Wi-Fi and mobile carriers.
