# T20 — Chat rooms backend

Depends: T05
Read: 01-FEATURES F8 (Room lifecycle 1-3, Security), 02-ARCHITECTURE A4, A5 (chat_rooms), A6 (`chat:*`), A7 (chat routes)

Build `api/modules/chat/`:
- `POST /api/chat/rooms {code?, authKey, kdfSalt}`: code optional (4-16 `[A-Za-z0-9]`, stored uppercase; reserved list) else random 8 Crockford; 409 `SLUG_TAKEN` if exists; store argon2id(authKey) (A4 params), salt, manage token sha256 in PG; return `{code, url, manageToken}`. Rate limit 10/h/ip.
- `GET /api/chat/rooms/:code/salt` → `{kdfSalt}`; unknown code → deterministic fake salt (HMAC(IP_PEPPER, code)), same latency path.
- `POST /api/chat/rooms/:code/ticket {authKey}`: lockout via Redis counters (`chat:lock:*` 5 fails/15 min → `ROOM_LOCKED` with retryAfter; `chat:lockg:*` 30/h) → argon2 verify → ticket 32 random bytes, Redis `chat:ticket:{sha256}` = CODE, TTL 60 s (rt consumes with `GETDEL`) → `{ticket}`. Touch `last_active_at` (throttled).
- `POST /api/chat/rooms/:code/manage {manageToken, action:'delete'|'repassword', authKey?, kdfSalt?}`: delete → PG row removal + `DEL chat:{CODE}:*` + emitter `chat:closed` + `disconnectSockets` on `/chat` room; repassword → replace salt+hash + same closure with reason `repassword`.

Acceptance: integration: wrong password x5 → locked; ticket single-use + expires; unknown room salt same shape; manage token required; delete closes live sockets on rt.

Do NOT: store or log authKey or raw ticket.
