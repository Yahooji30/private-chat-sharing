# T14 — Link codes (Redis) + linked devices/IPs backend

Depends: T05 (T09 for revoke disconnect)
Read: 01-FEATURES F5, 02-ARCHITECTURE A5 (devices, space_ips), A6 (`link:*`), A7 (link routes), A13 (rate limits)

Build `api/modules/link/`:
- `POST /api/link/code`: 8-char Crockford code; Redis `link:{sha256}` json `{spaceId, by}` TTL 300 s; `link:n:{spaceId}` counter max 3 active; returns `{code, expiresAt, url: PUBLIC_ORIGIN/link?c=CODE}`.
- `POST /api/link/redeem {code}`: normalizeCode → `GETDEL link:{sha256}` (atomic single-use) → set `devices.space_id`, `linked_at`; invalidate resolve cache; emitter `link:joined` to space room and `space:switch` to the redeeming device room (client reloads). Rate limit 5/min + 20/h per ipHash. Same space → no-op 200.
- `GET /api/link/list`: linked devices of space + alias networks (id, createdAt, label "Network #n").
- `DELETE /api/link/device/:id`: set space_id NULL, invalidate cache, emitter `link:revoked` to that device and `disconnectSockets` from the old space room.
- `POST /api/link/ip {ip}`: validate public IP (reject private, loopback, link-local, CGNAT 100.64/10, reserved); store alias row `kind=alias`; if ipHash already default of another space → `force:true` required else 409.
- `DELETE /api/link/ip/:id`.

Acceptance: integration tests: code single-use under 20 parallel redeems (exactly 1 wins), expiry via TTL, brute-force limit, unlink disconnects socket on rt, private IP rejected.

Do NOT: return raw IP after creation response; add a link_codes table.
