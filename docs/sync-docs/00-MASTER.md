# SYNC — Master Build Prompt (v2)

Working name: **Sync** (final name TBD → every user-facing name comes from env `APP_NAME`; code slug `sync`).
Product: clone of ssavr.com core features (network text sync, file sharing, device linking, public pages) + new **Secure Chat** + **Blog/CMS** + **Admin**.
Host: single Hostinger VPS (client-owned). Client owns code, data, hosting.

---

## 0. How Claude must work on this repo (READ FIRST, EVERY SESSION)

1. One session = one task file from `tasks/`. Do not start next task unasked.
2. Per task read ONLY: this file + task file + doc sections the task lists under `Read:`. Do not scan whole repo.
3. Before coding: check `Depends:` tasks exist in repo. If missing → stop, say which.
4. Output only files listed in task. No extra features, no placeholder pages, no demo data, no commented-out code, no TODO stubs unless task says.
5. No emoji anywhere (code, UI copy, commits, docs).
6. TypeScript strict everywhere. ESM only. No `any` except at trusted lib boundaries with comment.
7. Shared contracts (zod schemas, event names, constants) live ONLY in `shared/`. Never redefine in frontend/backend/admin.
8. After task: run `pnpm -r typecheck` + `pnpm -r lint` + task tests. Fix until green. Then print: files changed, how to verify, nothing else.
9. If spec ambiguous → choose simplest option consistent with `01-FEATURES.md`, note it in 1 line at end.
10. Keep functions small, no dead code, no duplicated logic, no unused deps.
11. Redis keys only through `core/redis/keys.ts`; Lua only in `core/redis/lua/`. Every Redis key has a TTL (except the two listed in 02 A6).

---

## 1. Scope

IN:
- F1 Network Space (auto space per public IP)
- F2 Live Text Sync (+ copy, saved state, clickable URLs panel)
- F3 P2P File Sharing, resumable upload (share) and download, block-verified, multi-source, no file stored on server
- F4 Device Presence (online devices list, device names)
- F5 Device Linking (8-char code + QR, single-use 5 min, manual IP link, unlink)
- F6 Settings (font, size, theme, URLs panel toggle, ads toggle, device name, linked devices)
- F7 Public Pages (publish markdown text to public link)
- F8 Secure Chat (NEW: password room, max 4, E2EE, ciphertext in Redis, no history for joiners/rejoiners, wiped when room empties)
- F9 Blog / Articles (SEO, admin managed)
- F10 Admin panel
- F11 Ads slots, legal pages, PWA

OUT (do not build, do not link): Secret Notes (`/note/create`), Features page, FAQ, Changelog, ssavr Articles (replaced by F9), Contact, Debug, Settings → Security (space password).

---

## 2. Tech stack (locked, v2)

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 24 LTS (move to 26 once its LTS lands, Oct 2026, after deps confirm) | active LTS, stable |
| Pkg mgr | pnpm 10 workspaces | disk + speed |
| API service | Fastify 5 (`sync-api`, :4000) | lowest overhead mainstream, schema validation |
| Realtime service | Socket.IO 4.8 (`sync-rt`, :4001), websocket-only, `@socket.io/redis-adapter` | separate process + port, cluster-safe without sticky sessions |
| API to realtime events | `@socket.io/redis-emitter` | no HTTP hop between services |
| Validation | zod 4 (+ `fastify-type-provider-zod`) | one schema shared FE/BE |
| Database | PostgreSQL 17+ via `postgres` driver + Drizzle ORM (pg-core), drizzle-kit migrations | multi-process safe, MVCC, full-text search for blog, scale path |
| Redis | Redis 7+ (or Valkey 8) via `ioredis`; no persistence | adapter, chat streams, tickets, link codes, rate limits, cache, text hot copy |
| Auth (admin) | `@node-rs/argon2` + own session table + httpOnly cookie + CSRF | no JWT leakage |
| Security | `@fastify/helmet`, `@fastify/rate-limit` (Redis store), `@fastify/cors` (admin origin only) | |
| Images (blog) | `sharp` → webp, concurrency 1 | |
| Markdown | `markdown-it` + `sanitize-html` (server render, store html) | |
| Frontend | Nuxt 4 (latest 4.x; NOT 5 until stable) + Vue 3.5 + Tailwind CSS 4 + Pinia + `@vueuse/core` | SSR/SWR for SEO, client islands for app |
| SEO | `@nuxtjs/sitemap`, `@nuxtjs/robots` | |
| PWA | `@vite-pwa/nuxt` | |
| P2P | native `RTCPeerConnection`, Web Worker + OPFS `FileSystemSyncAccessHandle` for block I/O | resumable random-access writes, no libs |
| Zip | `client-zip` (streaming) | |
| QR | `qrcode` (render), `qr-scanner` (camera) | |
| Crypto (client) | WebCrypto only (PBKDF2, HKDF, AES-GCM, SHA-256) | no libs |
| Admin | Vue 3 + Vite 7 SPA + vue-router + Pinia + Tailwind 4 | light, static build |
| Tests | Vitest, `@playwright/test`, real PG + Redis (CI service containers / dev docker-compose) | no mocks for stores |
| Lint | ESLint 9 flat + typescript-eslint + vue plugin | |
| Proxy | Nginx + certbot | |
| Process | PM2 (cluster mode) | |
| TURN (optional) | coturn on same VPS, off by default | P2P fallback |

Pin exact versions via lockfile at T01. Use latest stable at install time; no deprecated packages.

---

## 3. Repo layout

```
sync/
  shared/        # zod schemas, types, constants, socket event names (TS, built with tsup)
  backend/       # ONE package, two entrypoints: api (:4000) and rt (:4001)
  frontend/      # Nuxt 4 public site + app (port 3000)
  admin/         # Vue SPA, static build served by nginx at admin.<domain>
  deploy/        # nginx conf, pm2 ecosystem, coturn conf, backup script, dev/docker-compose.yml
  docs/          # these .md files
  pnpm-workspace.yaml
  package.json
  .env.example
```

Backend internal layout:
```
backend/src/
  core/          config/env.ts, db/{schema,client,migrations}, redis/{client,keys,lua/*.lua}, lib/{crypto,ip,ids,markdown,cache}, errors
  api/           server.ts, plugins/{space-resolver,admin-auth,error-handler}, modules/<name>/{routes,service,repo}
  rt/            server.ts, space/, chat/, rtc/, text-flusher.ts
  jobs/          cleanup.ts (inside api, Redis-locked)
```
Modules: `space`, `text`, `files`, `link`, `settings`, `public-pages`, `chat`, `blog`, `media`, `admin`, `ads`.

Frontend layout:
```
frontend/app/
  pages/ components/ composables/ stores/ plugins/ utils/ assets/ layouts/
  lib/webrtc/  lib/crypto/  workers/
```

---

## 4. Architecture summary

```
Browser ── HTTPS ──> Nginx ─┬─ /api/*       ──> sync-api :4000 (Fastify, cluster)  ──> PostgreSQL, Redis
                            ├─ /socket.io/* ──> sync-rt  :4001 (Socket.IO, cluster) ──> Redis (adapter, chat, text), PostgreSQL (flush)
                            ├─ /media/*     ──> /var/sync/media (static, blog images only)
                            ├─ admin.<domain> ─> admin/dist (static)
                            └─ everything else ─> sync-web :3000 (Nuxt Nitro SSR/SWR)
sync-api ── redis-emitter ──> Redis ──> sync-rt ──> sockets
Browser <── WebRTC DataChannel (P2P, files, resumable blocks) ──> Browser   (STUN; optional TURN relay, never stores)
```
- Full detail, capacity, failure modes: `02-ARCHITECTURE.md`. Feature behavior: `01-FEATURES.md`. Deploy: `04-DEPLOY.md`.

---

## 5. Global rules

- Never store raw IPs. Store `HMAC_SHA256(IP_PEPPER, normalizedIp)` only.
- Never store file bytes on server (F3). Blog media is the only exception (admin uploads).
- Chat messages: ciphertext only, Redis only (never PG, never disk), capped ring + TTL, deleted when room empties. Server never holds keys.
- Redis has persistence OFF. PG sealed columns (AES-256-GCM) hold all user text at rest.
- Every HTTP input validated by shared zod schema. Every socket payload validated too.
- Every public endpoint rate-limited. Size caps on every body.
- Error responses: `{ error: { code: string, message: string } }`. Codes enum in `shared/`.
- UI: mobile-first, app-like, dark + light theme, 60fps, no layout shift, accessible (labels, focus, contrast AA).
- UI copy uses `APP_NAME` from runtime config.

---

## 6. Task index (run in order)

| ID | Task | Phase |
|---|---|---|
| T01 | Monorepo scaffold (+ dev docker-compose for PG and Redis) | A Foundation |
| T02 | Shared package (schemas, events, constants) | A |
| T03 | Backend bootstrap (core, api entry, rt entry, PG + Redis clients) | A |
| T04 | PostgreSQL schema, migrations, Redis keys + Lua, cleanup jobs | A |
| T05 | Space resolution (IP → space, device cookie, Redis cache) | A |
| T06 | Text sync (rt service, Redis hot copy, PG write-behind) | B Core |
| T07 | Frontend bootstrap (Nuxt, theme, layout, API + socket client) | B |
| T08 | Editor UI (live text, copy, saved, URLs panel) | B |
| T09 | Presence (adapter-derived, devices online, names) | B |
| T10 | WebRTC signaling (rt) + ICE config (api) | C Files |
| T11 | WebRTC peer + resumable block transfer engine (frontend lib + worker) | C |
| T12 | File manifest + share (upload) flow with hashing + file list UI | C |
| T13 | Download manager: resume, multi-source, preview, save, zip all, delete | C |
| T14 | Link codes (Redis) + linked devices/IPs backend | D Link |
| T15 | Link UI (QR show/scan, /link page, settings tab) | D |
| T16 | Settings backend + UI | E |
| T17 | Public pages backend | E |
| T18 | Public pages UI | E |
| T19 | Chat crypto lib (client) | F Chat |
| T20 | Chat rooms backend (create, verify, lockout, tickets in Redis) | F |
| T21 | Chat realtime (rt): Redis stream relay, slots, resume, wipe | F |
| T22 | Chat UI | F |
| T23 | Blog backend | G Blog |
| T24 | Media upload backend | G |
| T25 | Blog frontend + SEO (sitemap, RSS, JSON-LD) | G |
| T26 | Admin auth backend | H Admin |
| T27 | Admin app scaffold | H |
| T28 | Admin blog + media screens | H |
| T29 | Admin ops (dashboard, public pages moderation, ads, site settings) | H |
| T30 | Ads, legal pages, landing content | I |
| T31 | PWA | I |
| T32 | Test suites (integration + e2e) | J |
| T33 | Security + performance hardening pass | J |
| T34 | Deploy configs (Hostinger VPS) | J |
| T35 | README + ops runbook | J |

Session prompt template (paste to Claude Code):
```
Read docs/00-MASTER.md and docs/tasks/TXX-*.md. Implement TXX only, following §0 rules.
```

Open decisions (defaults apply until changed):
- D1 Chat content logic: default E2EE (server sees ciphertext only, no content logic). Alternative: server-readable messages, loses E2EE.
- D2 Offline sender: default pure P2P (file unavailable while no holder online). Alternative: optional server staging with resumable tus upload, TTL 7 days, quota, off by default (not in task list until approved).
