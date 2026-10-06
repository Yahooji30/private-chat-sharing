# T10 — WebRTC signaling (rt) + ICE config (api)

Depends: T09
Read: 01-FEATURES F3 (Connectivity, Security), 02-ARCHITECTURE A7 (`/rtc/ice`), A8 (`rtc:signal`)

Build:
- `rt/rtc/signal.ts`: `rtc:signal {to, data}` → zod check (data = {type:'offer'|'answer', sdp ≤ 16 KB} | {type:'ice', candidate ≤ 2 KB} | {type:'bye'}); forward via adapter to all sockets of `to` device ONLY if that device is in the same space room (`fetchSockets` on `space:<id>` filtered by deviceId, or targeted per-device room `dev:<spaceId>:<deviceId>` joined on connect — prefer the room). Else drop silently. Rate limited.
- `api/modules/rtc/routes.ts`: `GET /api/rtc/ice` → STUN_URLS + (if TURN_ENABLED) TURN REST creds (A7), `Cache-Control: no-store`.

Acceptance: test: signal to device in other space never delivered; same space delivered across two rt instances; TURN creds format valid (username `exp:deviceId`, HMAC-SHA1 base64).

Do NOT: store SDP/candidates; no logging of payloads.
