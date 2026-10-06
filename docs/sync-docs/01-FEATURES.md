# SYNC — Feature Specification

Reference behavior: ssavr.com (Simple.Savr v4.2, Oct 2026), minus excluded pages. Each feature: purpose, user flow, rules, limits, edge cases.

---

## F1. Network Space

Purpose: zero-signup shared workspace for all devices behind same public IP.

How it works:
1. Any request → backend resolves `spaceId`:
   1. device cookie `sid_dev` present AND device linked to a space → that space.
   2. else hashed IP matches a linked-IP alias → alias target space.
   3. else default space for hashed IP (auto-created on first visit).
2. `ipHash = HMAC_SHA256(IP_PEPPER, normalizeIp(ip))`.
   - IPv4: full address.
   - IPv6: first /64 prefix (devices on same LAN share prefix, differ in suffix).
   - IPv4-mapped IPv6 (`::ffff:1.2.3.4`) → IPv4.
3. Dual-stack mismatch fix: domain publishes A record only (no AAAA) → all devices reach via IPv4 → same space. /64 rule is fallback.
4. Device cookie `sid_dev`: random 128-bit id, httpOnly, Secure, SameSite=Lax, 400 days. Identifies device for presence, linking, names. Not a login.
5. Space has random 32-byte `salt` → per-space data key (see Architecture §Crypto).

Rules:
- Raw IP never stored or logged (pino redact `req.ip`, nginx log format without IP or with truncated IP).
- Space auto-expires after 90 days no activity (text, files manifest, settings, links deleted).

Known limitation (document in UI help): mobile carrier CGNAT / public WiFi → unrelated users may share IP → share space. ssavr solves with space password (Security settings, out of scope). Recommend client re-enable password later.

---

## F2. Live Text Sync

UI: full-height textarea (home page `/`). Toolbar: Saved state indicator, Copy, URLs, Upload/Send files, Download all.

Flow:
1. Load: `GET /api/text` → `{ content, rev }` (Redis hot copy, PostgreSQL fallback).
2. Typing → debounce 400 ms → socket `text:update { content, baseRev }`.
3. sync-rt: validate size, atomic Lua in Redis (`rev + 1`, hot copy, mark dirty), ack `{ rev }`, broadcast `text:changed { content, rev, by: deviceId }` to other sockets in space (any rt instance, via adapter). A flusher batches dirty spaces into PostgreSQL (sealed) about every second and on shutdown.
4. Receiver: if local editor has no unsent changes → replace content, preserve cursor/selection (map by offset diff of common prefix/suffix). If has unsent changes → keep local, its next send wins (last-write-wins).
5. Saved indicator states: `Saving…` (pending) → `Saved` (acked) → `Offline` (socket down; queue latest content, flush on reconnect).
6. Copy button → `navigator.clipboard.writeText`, fallback select+execCommand; toast "Copied".

Limits: 100,000 chars per space (server rejects `TEXT_TOO_LARGE`; UI counter turns red at 95%).

URLs panel (Links feature):
- Client scans text with URL regex (http/https/www.) → deduped clickable list, open in new tab `rel="noopener noreferrer nofollow"`.
- Togglable in Settings (F6). Off → panel + button hidden.

Edge: clearing text = save empty string (allowed).

---

## F3. P2P File Sharing (no server storage, resumable)

Requirement: file bytes never touch server disk or RAM. Sharing (upload) and downloading are both resumable: survive network drops, tab reload, browser restart, holder going offline, switching holder. Fast path = WebRTC DataChannel direct between devices (LAN near wire speed), multiple holders in parallel.

Concepts:
- **Manifest**: per-space list in PG `{ fileId, name, size, mime, blockSize, rootHash, thumb?, addedBy, addedAt, holders[] }`. Name/mime/thumb sealed at rest. Max 100 entries per space; expire after 7 days.
- **Block**: fixed 1 MiB unit (last may be shorter). Hash = SHA-256 per block. `rootHash = SHA-256(concat(blockHashes))`, stored in manifest once the sender finishes hashing. Block hash list (32 B x blocks, 128 KiB for 4 GiB) is never stored on server; any holder sends it P2P and the receiver verifies it against `rootHash`.
- **Holder**: device with ALL blocks (listed in `file_holders`). **Partial holder**: device with some verified blocks; announces a bitmap P2P and may serve those blocks. Availability = at least one holder or partial holder online.
- **Transfer state** (survives reload): per file in OPFS `files/<fileId>/data` (preallocated to `size`), `files/<fileId>/state.json` `{ rootHash, bitmap, updatedAt }` written debounced 500 ms and on `pagehide`.

Share (upload) flow:
1. User picks, drops or pastes files (multi). Client checks size limit and `navigator.storage.estimate()` quota.
2. Entry is added at once with status `Preparing` (`files:add`, rootHash null): thumbnail for images (canvas → webp ≤ 160 px, ≤ 24 KB), mime, size.
3. A worker hashes the file block by block (progress shown), while the picked `File` already serves reads via `Blob.slice` (zero copy).
4. Hashing done → `files:ready {fileId, rootHash}` → entry becomes downloadable on other devices. Worker then copies the file into OPFS in the background (so the holder survives reload). If the tab dies mid-copy, entry shows `Re-select file to finish`; picking the same file (name, size, rootHash verified) resumes.
5. Fallback without OPFS: in-memory only, no resume across reload, notice shown, 500 MB cap.
6. Optional auto-download (per device, default ON): online devices fetch files < 50 MB automatically.

Download flow (resumable, multi-source):
1. Receiver clicks Download (or auto) → manager loads `state.json` if any (resume) else creates it and preallocates `data`.
2. Connect to every online holder or partial holder through signaling (T10). One ordered reliable DataChannel `xfer` per peer, multiplexed by file.
3. Per peer: `{t:'meta', fileId}` → block hash list in binary frames + size + blockSize; verify against `rootHash`. Then `{t:'have', fileId, bitmap}` exchange (also on change).
4. Scheduler: keep up to 8 blocks in flight per peer (cap 24 total), pick missing blocks (rarest first, then lowest index), request `{t:'get', fileId, block}`. Holder replies in 64 KiB binary chunks (header: type, fileId, block, chunkIdx), honoring `bufferedAmount` (pause > 8 MiB, resume at `bufferedamountlow` 1 MiB). Chunk size = `min(64 KiB, sctp.maxMessageSize)`.
5. Each completed block: SHA-256 check → write at `block x blockSize` via `FileSystemSyncAccessHandle` in a worker (random access, out of order OK) → set bit → persist state. Hash mismatch: drop block, retry from another peer; 3 strikes marks that peer bad for this file.
6. Resume triggers (automatic): peer drop, ICE restart, holder offline then online (presence/holders event), tab reload (state on disk), browser restart. Missing blocks only are re-requested; verified blocks are never re-sent. User buttons: Pause, Resume, Cancel.
7. All blocks verified → `files:holder {fileId}` → becomes a source for others. Progress UI: bytes, speed, ETA, sources count.
8. Save to disk: `showSaveFilePicker` stream from OPFS file where available, else Blob URL from the OPFS `File` (disk-backed, not RAM).

Other actions:
- Preview: images/video/audio/pdf/text from local OPFS copy; before download, image thumb visible.
- Download all: stream all local files into zip via `client-zip` → save. Missing files fetched first.
- Delete: any device can delete entry → `files:remove` → every device drops OPFS copy + state.
- Clear all files: one button, confirm dialog.
- Startup GC: OPFS dirs not in manifest are deleted.

Limits: per file 4 GiB with OPFS, 500 MiB without. Manifest 100 files. Concurrency: 3 active files per device. Hashing and I/O always in workers (UI stays 60 fps).

Connectivity: STUN (`stun:stun.l.google.com:19302` + self coturn STUN). If ICE fails → "Direct connection blocked by network. Try same Wi-Fi or enable relay." If `TURN_ENABLED=true` → time-limited TURN creds; relay traffic passes through the VPS but is never stored. ICE restart on network change.

Security: DataChannels DTLS-encrypted by WebRTC. Peers only in same space can signal each other (server enforces). Block hashes make a corrupted or malicious holder detectable.

Not in scope (decision D2): server-side staging for offline senders.

---

## F4. Device Presence

- Socket connect → server joins `space:<spaceId>` room. Presence is derived from the Socket.IO adapter (`fetchSockets`), so it is correct across rt instances and self-heals after a crash; no presence keys stored.
- Broadcast `presence:list` on join/leave (multiple tabs same device collapse to one entry).
- Device name: default generated "Adjective Animal" (e.g. "Blue Fox"); editable in Settings; stored per deviceId in DB.
- UI: top bar avatars/dots of online devices + count; click → list with names + "this device".

---

## F5. Device Linking

Purpose: devices on different networks (phone on mobile data) join same space.

Link by code:
1. Device A (in space) → Settings → Link Devices → Generate → `POST /api/link/code` → `{ code, expiresAt, url }`.
   - Code: 8 chars, Crockford base32 (no I L O U), shown `XXXX-XXXX`.
   - Stored hashed (SHA-256) in Redis with spaceId, TTL 5 min, redeemed with atomic `GETDEL` (single use, race-free).
   - QR encodes `https://<domain>/link?c=<code>`.
2. Device B scans QR or opens `/link` and types code → `POST /api/link/redeem { code }`.
3. Server: valid + unused + unexpired → link B's `deviceId` → space; mark used; emit `link:joined` to space. B redirected to `/`.
4. Brute-force: redeem limited 5/min/IP, 20/hour/IP.

Link by IP (manual):
- Settings → Link Devices → "Link a network" input IP → server stores alias `ipHash(input) → spaceId`. Requester must currently be in space. Validate IP syntax; reject private/reserved ranges.

Linked list + unlink:
- Settings shows linked devices (name, type, linkedAt, last seen) and linked networks (masked IP shown only once at creation; afterwards "Network #n added <date>").
- Unlink → delete link row → affected device immediately disconnected from space room (`link:revoked`) and falls back to its IP space.

---

## F6. Settings (per space unless noted)

Route `/settings`, tabs: Appearance, Editor, Devices, Link Devices. (No Security tab.)
- Appearance: theme (system/light/dark) [per device, localStorage], font family (Sans, Serif, Mono), font size (12–28 px, slider, clamp; never 0).
- Editor: URLs panel on/off, auto-download files <50 MB on/off [per device], spellcheck on/off [per device].
- Ads: "Hide ads on all my devices" toggle (space-level `adsDisabled`).
- Devices: this device name (editable), online devices list.
- Link Devices: F5 UI.
Space-level settings persisted `GET/PUT /api/settings`, broadcast `settings:changed`.

---

## F7. Public Pages ("Public Savrs")

- `/public` → list of pages created from this space (title, slug, views, updatedAt) + New.
- `/public/new` → title + markdown body (max 50,000 chars) + optional custom slug (3–60, `[a-z0-9-]`) + live preview.
- Publish → `/p/<slug>` (random 8-char slug if none). SSR page, rendered sanitized HTML, `noindex` default (toggle "Allow search engines").
- Edit/delete only from owning space (`ownerSpaceId`). Edit key also returned once (`editToken`) so owner can edit from another network: `/public/<slug>/edit?k=`.
- View counter (dedupe per ipHash per 24h via Redis `SET NX EX`).
- Report link on page → admin moderation queue (F10). Admin can unpublish.
- Rate limit create 10/hour/space.

---

## F8. Secure Chat (new)

Goal: temporary private group chat, password room, max 4 people, end-to-end encrypted, no history for anyone who joins or rejoins, wiped when the room empties.

Room lifecycle:
1. Create (`/chat`): user enters password (min 8 chars, strength meter) + optional custom room code (4-16, `[A-Za-z0-9]`) → client derives keys (see Architecture A4) → `POST /api/chat/rooms { code?, authKey, kdfSalt }` (kdfSalt generated client-side, 16 bytes).
   Server stores in PG `{ code, kdfSalt, authHash=argon2id(authKey), createdAt, lastActiveAt, manageTokenHash }`. Returns `{ code, url: /c/<code>, manageToken }`.
2. Share link `/c/<code>` (copy button, QR, native share). Password shared separately (UI tells user).
3. Join: open link → password prompt → client fetches `kdfSalt` → derives `authKey` + `encKey` → `POST /api/chat/rooms/:code/ticket { authKey }` → server argon2 verify → single-use ticket (Redis, 60 s).
4. Socket `/chat` (sync-rt) with ticket → atomic Lua join: free slot or `chat:full` (max 4) → slot 0-3 → `chat:members { count, slot, slots, color, resumeToken }`. Client cursor starts at the stream tail.
5. Messages: client AES-GCM encrypts with `encKey` → `chat:msg { iv, ct }` → rt validates (≤ 8 KB, rate) → `XADD` to `chat:<CODE>:msgs` (ring of `CHAT_MSG_CAP`, default 200) → fan-out to the other members with stream `id` → clients decrypt.
6. Leave / disconnect → slot freed (explicit leave: now; abrupt drop: after grace), `chat:members` broadcast, neutral system line "Someone left" / "Someone joined".

History and storage rules (exact requirement):
- Where messages live: Redis only, ciphertext only, bounded ring + idle TTL. Never PG, never disk (Redis persistence off).
- New joiner and rejoiner receive NO earlier messages: their cursor starts at the stream tail at join time.
- Resume vs rejoin: a network drop with the tab alive and keys in memory resumes the same slot within `CHAT_RESUME_GRACE_S` (default 120 s) and replays only what was missed during the gap. Reload, closing the tab, or pressing Leave means keys are gone: it is a rejoin (password again) and the screen starts empty.
- When the last member leaves (or the last grace expires) the stream, slots and meta keys are deleted immediately. Idle TTL (24 h) is only a safety net.
- Clients keep messages in component state only (cap 500), wiped on leave/unload.
- Room record (code + verifier) persists 12 months since last activity so link + password keep working; then purged and code recyclable.
- Server logic available (metadata only): rate limit, size cap, ordering, member count, typing, delivery recovery, expiry, live-room counts for admin. No content logic by design (decision D1).

UI rules: no names, no timestamps, no read receipts, no avatars. Bubbles colored by slot (4-color palette, random order per room session). Own bubbles right-aligned. Typing indicator = `chat:typing` boolean only. Max message 2,000 chars. "Room full (4/4)" screen. "Leave & wipe" button. Tab blur → optional blur of screen content (privacy toggle).

Security:
- Wrong password attempts: 5 per 15 min per (ipHash, code), then 15 min lockout; global 30/hour/ip (Redis counters).
- Server never sees password or `encKey`.
- Unknown room: `salt` endpoint returns a deterministic fake salt (existence not leaked).
- Room manage: with `manageToken` creator can delete room or change password (new salt → link stays, old password dead, live sessions closed).
- CSP strict on chat routes; no third-party scripts (no ads) on `/c/*`.

---

## F9. Blog / Articles

Public:
- `/blog` paginated list (12/page), featured post, category filter chips.
- `/blog/<slug>` article: title, cover (responsive webp srcset), author name (admin display name), published date, reading time, TOC from h2/h3, content, tags, related posts (same category, 3), share buttons (links only, no SDK scripts).
- `/blog/category/<slug>`, `/blog/tag/<slug>`.
- SEO: unique title/description/canonical/OG/Twitter per page, JSON-LD `Article` + `BreadcrumbList`, `sitemap.xml` (static + articles + categories + public pages that allow indexing), `robots.txt`, `rss.xml`.
- Caching: Nuxt route rules SWR 10 min; admin publish → backend calls frontend revalidate hook to purge.
Statuses: draft, scheduled (`publishAt` future → job publishes), published, archived.

---

## F10. Admin Panel (`admin.<domain>`)

- Login (email + password, argon2id), optional TOTP 2FA, lockout 5 fails/15 min, session 12 h sliding, logout all sessions.
- Dashboard: counts only (online devices, active spaces 24h, active chat rooms now, rooms total, articles, public pages, reports open). No user content shown.
- Articles: list/search/filter, editor (markdown + live preview, cover upload, SEO fields, slug, category, tags, status, schedule), autosave draft.
- Categories, Tags CRUD.
- Media library: upload (drag/drop, max 10 MB, jpg/png/webp/gif→webp), browse, copy URL, delete (blocked if used).
- Public pages moderation: reports queue, view page, unpublish/delete.
- Ads: manage ad slots (key, html snippet or AdSense client/slot ids, enabled) + global ads on/off.
- Site settings: site name, tagline, default OG image, social links, analytics id (optional), legal page content (privacy, terms) in markdown.
- Admin users: owner can add/remove admins.
- Audit log of admin actions.

---

## F11. Ads, Legal, PWA, Landing

- Ad slots: `top-banner`, `sidebar`, `in-article`, `footer`. Rendered only if globally enabled AND space `adsDisabled=false` AND route not `/c/*`. Reserved height to avoid CLS.
- Legal pages: `/privacy`, `/terms` (content from admin settings). Required for AdSense.
- Landing SEO content under editor on `/` (short how-it-works, SSR) — not a features page.
- PWA: installable, app icons, offline shell ("You are offline"), share-target for files/text into home (Android).
