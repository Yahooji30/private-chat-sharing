# T05 — Space resolution

Depends: T04
Read: 01-FEATURES F1, F4 (device name), 02-ARCHITECTURE A3, A5 (spaces, space_ips, devices), A6 (`rs:*`)

Build:
- `api/modules/space/service.ts` (importable by rt): `resolve(ip, deviceCookie)` per F1 order; auto-create space (+ salt, default ip row, default settings row); upsert device (name = random "Adjective Animal" from 2 short word lists, type from UA: phone/tablet/desktop); touch `last_active_at` max once per 5 min (Redis `SET NX EX 300` throttle).
- Resolve cache in Redis (`rs:ip:*`, `rs:dev:*`, TTL 300 s). Export `invalidateSpaceCache({ipHash?, deviceHash?})` for link/unlink/rename.
- `api/plugins/space-resolver.ts`: preHandler for `/api` non-admin routes: issue `sid_dev` cookie if missing (128-bit random, cookie stores raw, DB stores sha256), attach `req.space`, `req.device`. Same fn used by Socket.IO middleware in rt (parse cookie from handshake).
- `routes.ts`: `GET /api/space/me`, `PATCH /api/device {name}` (1-32 chars, trimmed).

Acceptance (integration, `app.inject`, real PG + Redis):
- 2 requests same IP no cookie → same spaceId, different devices.
- Different IPs → different spaces.
- IPv6 same /64 → same space.
- Linked device (insert row manually) → linked space regardless of IP.
- Cache hit path makes zero PG queries; invalidation works.

Do NOT: store raw IP anywhere.
