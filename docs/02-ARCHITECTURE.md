# SYNC — Architecture (v2: PostgreSQL + Redis, split api / realtime)

## A0. System design summary

Three Node processes + two data stores on one VPS, each with one job:

| Process | Port | Job | Scales by |
|---|---|---|---|
| `sync-api` | 4000 | REST: CRUD, auth, uploads (blog media), admin, cron jobs (Redis-locked) | PM2 cluster (stateless) |
| `sync-rt` | 4001 | Socket.IO only: `/space` + `/chat` namespaces, WebRTC signaling, text write-behind flusher | PM2 cluster, websocket-only transport, Redis adapter |
| `sync-web` | 3000 | Nuxt SSR/SWR | PM2 cluster (stateless) |

| Store | Role | Persistence |
|---|---|---|
| PostgreSQL 17+ | durable truth: spaces, devices, text, settings, file metadata, rooms (verifier only), public pages, blog, admin, audit | yes, daily `pg_dump` |
| Redis 7+ (or Valkey 8, drop-in) | realtime glue + ephemeral data: Socket.IO adapter/emitter, chat messages, chat slots, tickets, link codes, rate limits, resolve cache, text hot copy | NONE (`save ""`, `appendonly no`) by design |

Why this split:
- API and realtime in separate processes: a slow request or blog image upload (sharp) never stalls sockets; realtime can restart without dropping REST; each scales alone.
- Two processes (and clusters) need shared fast state and cross-process events. That is Redis. API pushes events to sockets through `@socket.io/redis-emitter`; no HTTP between api and rt.
- SQLite dropped: fine for one process, but two processes + cluster mean multi-writer contention, no cross-process locking, no scale path. PostgreSQL handles it with MVCC and still fits a 4 to 8 GB VPS.
- Chat messages live in Redis, not SQL: they are ephemeral, write-heavy, must vanish when the room empties, and must never touch disk. Redis TTL + DEL does exactly that; SQL would need delete jobs, vacuum, WAL writes of data we promised not to keep.
- RAM is bounded, so it scales: every ephemeral key has a cap and TTL (see A10 capacity).

## A1. Env (`.env.example`, parsed by `backend/src/core/config/env.ts` with zod)

```
APP_NAME=Sync
NODE_ENV=production
PUBLIC_ORIGIN=https://example.com
ADMIN_ORIGIN=https://admin.example.com
API_PORT=4000
RT_PORT=4001
DATABASE_URL=postgres://sync_app:<pw>@127.0.0.1:5432/sync
PG_POOL_MAX=10
REDIS_URL=redis://:<pw>@127.0.0.1:6379/0
MEDIA_DIR=/var/sync/media
MASTER_KEY=<64 hex>          # data-at-rest root key (PG sealed columns)
IP_PEPPER=<64 hex>           # HMAC key for IP hashing
COOKIE_SECRET=<64 hex>
REVALIDATE_SECRET=<32 hex>   # backend -> nuxt cache purge
NUXT_INTERNAL_URL=http://127.0.0.1:3000
TRUST_PROXY=127.0.0.1
STUN_URLS=stun:stun.l.google.com:19302
TURN_ENABLED=false
TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349
TURN_SECRET=<64 hex>
CHAT_MSG_CAP=200             # max entries kept per room stream
CHAT_IDLE_TTL_S=86400        # safety TTL on all chat keys, refreshed on activity
CHAT_RESUME_GRACE_S=120      # slot held after abrupt disconnect
TEXT_FLUSH_MS=1000           # Redis -> PG write-behind interval
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
```
Frontend runtime config: `NUXT_PUBLIC_APP_NAME`, `NUXT_PUBLIC_API_BASE=/api`, `NUXT_REVALIDATE_SECRET`.

## A2. Backend code layout (one package, two entrypoints)

```
backend/src/
  core/        config/env.ts, db/{schema,client,migrations}, redis/{client,keys,lua}, lib/{crypto,ip,ids,markdown,cache}, errors
  api/         server.ts (entry), plugins/, modules/<name>/{routes,service,repo}
  rt/          server.ts (entry), space/, chat/, rtc/, text-flusher.ts
  jobs/        cleanup.ts (runs inside api, guarded by Redis lock)
```
Build outputs `dist/api.js`, `dist/rt.js`. Shared logic (services/repos) lives in `core` or module services imported by both; rt never imports Fastify.

Redis keys are built only via `core/redis/keys.ts`. Lua scripts only in `core/redis/lua/*.lua`, loaded once, called with `EVALSHA`.

## A3. Crypto (`core/lib/crypto.ts`)

- `hashIp(ip) = HMAC_SHA256(IP_PEPPER, normalizeIp(ip))` → hex.
- Space data key: `HKDF_SHA256(MASTER_KEY, salt=space.salt, info="space-data")` → 32 bytes. Small in-process LRU (derived keys only, 10k, 10 min).
- `seal(key, plaintext) → base64(iv12 | ct | tag16)` AES-256-GCM; `open(key, sealed)`. Applied to PG columns holding user text/file names. Redis holds hot plaintext copies; Redis is bound to localhost, password protected, and never persisted, so nothing user-readable reaches disk.
- Tokens (link code, ticket, manage, edit, session): stored as SHA-256 hex; compare with `timingSafeEqual`.
- Random ids: `crypto.randomBytes`; Crockford base32 in `lib/ids.ts`.

## A4. Chat crypto (client, `frontend/app/lib/crypto/chat.ts`)

```
master = PBKDF2-SHA256(password, kdfSalt, 600000 iter) -> 256 bit
authKey = HKDF(master, info="sync-chat-auth")  -> 32 bytes, sent to server (base64)
encKey  = HKDF(master, info="sync-chat-enc")   -> AES-GCM CryptoKey, non-extractable, never leaves client
msg: iv = 12 random bytes; ct = AES-GCM(encKey, iv, utf8(text), additionalData=utf8(roomCode))
```
Server stores `argon2id(authKey)` (m=19456 KiB, t=2, p=1). Messages in Redis are ciphertext only. Server compromise or Redis dump → no plaintext.

Consequence (decision D1): server cannot run logic on message content (search, moderation, filters). It can run logic on metadata: counts, size, order, rate, membership, delivery, expiry. If the client later wants content logic, E2EE must be dropped; not recommended (privacy is priority 1).

## A5. Data model — PostgreSQL (Drizzle `pg-core`, `postgres` driver)

Types: ids `text`, times `timestamptz`, blobs `bytea`, flags `boolean`, JSON `jsonb`.

```
spaces            id text pk (base32 16), salt bytea, created_at, last_active_at
space_ips         ip_hash text pk, space_id fk, kind text('default'|'alias'), created_at
devices           id text pk (sha256 of cookie), space_id fk NULL, name text, type text, linked_at NULL, last_seen_at
space_text        space_id pk fk, content_sealed text, rev integer, updated_at
space_settings    space_id pk fk, json jsonb   # {fontFamily, fontSize, urlsPanel, adsDisabled}
file_entries      id text pk, space_id fk, meta_sealed text (name,mime,thumb), size bigint, block_size integer, root_hash text NULL, added_by text, added_at, expires_at
file_holders      file_id fk, device_id, pk(file_id, device_id)      # devices holding the COMPLETE file
public_pages      id pk, slug UNIQUE, owner_space_id fk NULL, edit_token_hash, title, body_md, body_html, indexable boolean, status('published'|'unpublished'), views integer, created_at, updated_at
page_reports      id pk, page_id fk, reason text, ip_hash, created_at, resolved_at NULL
chat_rooms        code text pk (stored upper, case-insensitive unique), kdf_salt bytea, auth_hash text, manage_token_hash, created_at, last_active_at
admins            id pk, email UNIQUE, name, password_hash, totp_secret_sealed NULL, role('owner'|'admin'), failed_count, locked_until, created_at
admin_sessions    token_hash pk, admin_id fk, expires_at, ip_hash, ua, created_at
audit_log         id pk, admin_id, action, target, created_at
categories        id pk, slug UNIQUE, name, description
tags              id pk, slug UNIQUE, name
articles          id pk, slug UNIQUE, title, excerpt, body_md, body_html, toc_json jsonb, cover_media_id NULL, category_id NULL, author_admin_id, status, publish_at NULL, published_at NULL, seo_title, seo_description, og_media_id NULL, reading_min integer, search tsvector (generated, GIN index), created_at, updated_at
article_tags      article_id, tag_id, pk(both)
media             id pk, filename, mime, width, height, bytes, variants_json jsonb, alt, created_at
ad_slots          key pk, enabled boolean, html text
site_settings     key pk, value text
```
No table for link codes, chat messages, tickets (Redis only).
Indexes: every fk, `articles(status, published_at desc)`, `articles` GIN(search), `file_entries(space_id)`, `*.expires_at`, `chat_rooms(last_active_at)`, `spaces(last_active_at)`.
Pool: `PG_POOL_MAX=10` per process. Total connections = (api + rt instances) x 10, keep under `max_connections=60`. No pgbouncer needed at this size.
Migrations: drizzle-kit generated SQL, applied by `db:migrate` in release script (not at app boot, avoids cluster races).

## A6. Redis keyspace (all via `core/redis/keys.ts`)

| Key | Type | TTL | Purpose |
|---|---|---|---|
| `rs:ip:{ipHash}` | string spaceId | 300 s | resolve cache; DEL on link/unlink |
| `rs:dev:{devHash}` | string `spaceId\|name\|type` | 300 s | resolve cache; DEL on link/unlink/rename |
| `sp:{id}:text` | hash `{c: content, r: rev}` | 1 h idle (refreshed) | hot text copy, source for sync |
| `sp:dirty` | set of spaceIds | none | text awaiting PG flush |
| `link:{sha256(code)}` | string json `{spaceId, by}` | 300 s | link code, redeemed via `GETDEL` (atomic single-use) |
| `link:n:{spaceId}` | counter | 300 s | max 3 active codes/space |
| `chat:{CODE}:slots` | hash slot(0..3) → `sessionHash\|state\|graceUntil` | idle TTL | membership, capacity |
| `chat:{CODE}:msgs` | stream `{slot, iv, ct}` | idle TTL, MAXLEN ~ `CHAT_MSG_CAP` | ciphertext for relay + resume |
| `chat:{CODE}:meta` | hash `{palette}` | idle TTL | per-session random color order |
| `chat:grace` | zset member `CODE:slot`, score = expiry ms | none | abrupt-disconnect grace sweeper |
| `chat:ticket:{sha256}` | string CODE | 60 s | join ticket, `GETDEL` |
| `chat:lock:{ipHash}:{CODE}` | counter | 900 s | wrong-password attempts |
| `chat:lockg:{ipHash}` | counter | 3600 s | global attempts |
| `pv:{slug}:{ipHash}` | string | 86400 s | public page view dedupe (`SET NX EX`) |
| `rl:*` | `@fastify/rate-limit` store | per rule | all HTTP rate limits |
| `rt:stats:{pid}` | hash counts | 15 s | per-rt-node socket counts (admin dashboard sums) |
| `lock:jobs:{name}` | string | job interval | cron leader lock `SET NX EX` |

Redis config: `bind 127.0.0.1`, `requirepass`, `save ""`, `appendonly no`, `maxmemory 1gb` (KVM 2) / `384mb` (KVM 1), `maxmemory-policy volatile-lru`, all app keys carry a TTL (except `sp:dirty`, `chat:grace` which are tiny and swept).

## A7. HTTP API (prefix `/api`, served by `sync-api`)

Space (resolver plugin attaches `req.space`, `req.device`):
```
GET  /space/me                 -> { spaceId(short public form), device:{id,name,type}, linked:boolean }
GET  /text                     -> { content, rev }   (Redis, PG fallback)
GET  /settings                 PUT /settings
PATCH /device                  { name }
GET  /files                    -> manifest
GET  /rtc/ice                  -> { iceServers } (TURN creds if enabled, ttl 1h, username=`${exp}:${deviceId}`, credential=HMAC_SHA1(TURN_SECRET, username))
POST /link/code                -> { code, expiresAt, url }
POST /link/redeem              { code }
GET  /link/list                DELETE /link/device/:id   POST /link/ip {ip}   DELETE /link/ip/:id
GET  /public-pages             (mine)  POST /public-pages  PUT /public-pages/:slug  DELETE /public-pages/:slug
GET  /p/:slug                  (public read)   POST /p/:slug/report
POST /chat/rooms               GET /chat/rooms/:code/salt   POST /chat/rooms/:code/ticket
POST /chat/rooms/:code/manage  { manageToken, action:'delete'|'repassword', ... }
GET  /blog/articles?page&category&tag&q   GET /blog/articles/:slug   GET /blog/categories   GET /blog/tags/:slug
GET  /ads                      -> enabled slots (respecting space adsDisabled)
GET  /site                     -> public site settings
GET  /sitemap-data             -> slugs + lastmod for sitemap
GET  /health                   -> { ok, pg, redis, uptime, rssMb }
```
Admin (`/api/admin`, cookie session + CSRF header `x-csrf` double-submit):
```
POST auth/login  POST auth/totp  POST auth/logout  GET auth/me
CRUD articles, categories, tags, media(upload multipart), ad-slots, site-settings, admins
GET  reports  POST reports/:id/resolve  POST public-pages/:slug/unpublish
GET  stats   GET audit
```
API to realtime events: `@socket.io/redis-emitter` (`settings:changed`, `link:joined`, `link:revoked`, `files:*` from admin actions, `chat:closed` + `disconnectSockets()`).

## A8. Socket.IO (served by `sync-rt`)

Server: `transports: ['websocket']` both sides (no sticky sessions needed, cluster-safe), `@socket.io/redis-adapter` (pub/sub), `maxHttpBufferSize` 1 MB for `/space` signaling (SDP only, never file data), 64 KB on `/chat`. Per-socket token bucket 20/s burst 40.

Namespace `/space` (auth: cookie → resolver; reject if no device):
```
C->S text:update {content, baseRev}           ack {rev}|{error}
S->C text:changed {content, rev, by}
S->C presence:list [{deviceId,name,type,self}]
C->S files:add [meta]   files:ready {fileId, rootHash}   files:remove {fileId}   files:clear   files:holder {fileId}
S->C files:added [entry] files:ready {fileId, rootHash} files:removed {fileId} files:cleared files:holders {fileId, holders}
C->S rtc:signal {to: deviceId, data}          (forwarded only if `to` in same space)
S->C rtc:signal {from, data}
S->C settings:changed {...}   link:joined {deviceId}   link:revoked {}
```
Namespace `/chat` (auth: `handshake.auth.ticket` for new join, or `handshake.auth.resume = {code, token, lastId}` for resume):
```
S->C chat:members {count, slot, slots:[0..3 occupied], color, resumeToken}
C->S chat:msg {iv, ct}        S->C chat:msg {id, slot, iv, ct}     (id = stream id, client keeps lastId)
C->S chat:typing {on}         S->C chat:typing {slot, on}
S->C chat:system {kind:'joined'|'left'}
S->C chat:full                S->C chat:closed {reason}
C->S chat:leave               (explicit leave: slot freed now, no grace)
```

Presence: derived from the adapter (`io.of('/space').in('space:<id>').fetchSockets()`), debounced 250 ms per space; no presence keys to leak on crash.

Text hot path (`text:update`): Lua script `text_update.lua`: validates, `HSET sp:{id}:text c rev+1`, `SADD sp:dirty id`, returns new rev; ack; broadcast. Flusher (each rt instance, `TEXT_FLUSH_MS`): `SPOP sp:dirty N`, read, seal, one batched PG upsert with `synchronous_commit=off` local to that tx. SIGTERM: flush all before exit. Worst-case loss on hard crash: last ~1 s of typing.

## A9. Background jobs (`jobs/cleanup.ts`, inside `sync-api`, each run guarded by `SET lock:jobs:<name> NX EX`)

- every 1 min: publish scheduled articles (+ revalidate); chat grace sweeper runs in rt (A10).
- every 1 h: delete expired file entries; spaces inactive 90 d (cascade); chat_rooms inactive 365 d; expired admin sessions.
- daily: `ANALYZE`; backup is cron + `pg_dump` (see deploy).

## A10. Chat design (Redis Streams)

Join (Lua `chat_join.lua`, atomic):
1. `chat:{CODE}:slots` has a free slot? else return FULL.
2. Pick lowest free slot, store `sha256(resumeToken)|live`, set meta palette if new session, `XADD` nothing.
3. Return `{slot, tailId = last stream id or "0"}`. Client cursor starts at `tailId` ⇒ a new joiner or rejoiner receives nothing from before (requirement: no history on rejoin).
4. All chat keys `EXPIRE` idle TTL.

Message: validate (ciphertext ≤ 8 KB, rate) → `XADD chat:{CODE}:msgs MAXLEN ~ CHAT_MSG_CAP * {slot,iv,ct}` → fan out via adapter to room with stream `id`. Stream exists only for resume and as bounded ring; nothing else reads it.

Resume (network drop, tab alive, within `CHAT_RESUME_GRACE_S`): client reconnects with `{code, token, lastId}`; server verifies token hash on the held slot, flips state live, `XRANGE (lastId +` → replays missed ciphertext, continues. Browser reload / tab close / explicit Leave = keys gone = normal join = empty history.

Disconnect without leave: slot state `grace`, `ZADD chat:grace now+grace CODE:slot`. Sweeper in each rt (every 10 s, `ZRANGEBYSCORE` + Lua `chat_free.lua`) frees expired slots. Explicit `chat:leave`: free slot immediately.

Empty room: whenever slots become all free → `DEL chat:{CODE}:slots chat:{CODE}:msgs chat:{CODE}:meta` in the same Lua script. Idle TTL is the safety net if a process dies mid-flow.

Room delete / repassword (api): `DEL` keys + emitter `chat:closed` + `disconnectSockets`.

Server-side logic available on messages (metadata only): per-room rate limit, size cap, ordering by stream id, member count/typing, delivery recovery, expiry, admin-visible counts (rooms live, members live). No content access (D1).

## A11. Capacity and failure modes

Sizing (KVM 2: 2 vCPU, 8 GB):
- Chat: avg ciphertext ~0.6 KB incl. overhead, cap 200 msgs → ≤ 120 KB typical, 1.2 MB worst per room (8 KB x 200 is the theoretical max; client limits 2,000 chars ≈ 3 KB → worst ≈ 600 KB). 5,000 live rooms typical ≈ 600 MB. `maxmemory 1gb`. Past that, `volatile-lru` evicts idle rooms' keys first.
- Text hot copies: ≤ 100 KB each, 1 h idle TTL; 2,000 active spaces worst ≈ 200 MB.
- Sockets: ~10 KB RAM per socket; 10k sockets ≈ 100 MB across rt instances.
- PG: text flush batches ≈ 1 write/s per active typing space coalesced; thousands of active spaces stay well under a few hundred TPS.
- Files: zero server bytes, zero server bandwidth (P2P). TURN relay (optional) is the only bandwidth risk; capped in coturn.

Failure modes:
| Failure | Effect | Handling |
|---|---|---|
| Redis down | realtime degraded; chat unavailable; API rate limit fails open for reads, closed for auth endpoints | PM2 restarts, health shows `redis:false`, clients auto-reconnect; text served from PG |
| Redis restart | all chat rooms emptied (by design), hot text lost ≤ 1 s | rooms (PG) survive; users rejoin |
| rt process crash | its sockets reconnect to sibling/new process in < 2 s; chat slots stay in grace and resume | adapter + grace |
| PG down | writes fail, `/health` red; sockets stay up, text in Redis keeps syncing, `sp:dirty` accumulates | flusher retries with backoff |
| Slow image upload | isolated in api process | sharp concurrency 1 |
| Cluster scale-out | add instances in ecosystem file | no sticky, adapter fan-out |

Scale path beyond one VPS: move PG and Redis to managed/dedicated hosts via env only; add rt/api instances on more VPS behind a load balancer. No code change.

## A12. Nuxt rendering

```
routeRules:
  '/':                 { swr: 3600 }      # landing shell SSR, editor <ClientOnly>
  '/blog/**':          { swr: 600 }
  '/p/**':             { swr: 300 }
  '/privacy','/terms': { swr: 86400 }
  '/settings','/public/**','/link','/chat','/c/**': { ssr: false }
```
Revalidate: Nitro route `POST /_revalidate` (header secret) → `useStorage('cache').removeItem` for affected keys. API calls it after article/page publish/update/delete.

## A13. Security baseline

- Helmet: CSP default-src 'self'; connect-src 'self' wss:; img-src 'self' data: blob:; frame-src only ad origins on ad routes; none on `/c/*`.
- Cookies: httpOnly, Secure, SameSite=Lax (admin: Strict, path /api/admin).
- Rate limits (per ipHash, Redis store): global 300/min; link redeem 5/min; chat ticket 5/15min/room; public page create 10/h; admin login 5/15min.
- Body limits: json 256 KB (text 100k chars fits), media 10 MB.
- Logs: pino, redact ip, cookies, authorization, body. Never log socket payloads.
- SQL only via Drizzle params. HTML only from sanitize-html allowlist.
- Redis and PG listen on localhost only; firewall closed; separate PG role `sync_app` (no superuser).
