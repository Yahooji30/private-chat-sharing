# T06 — Text sync (rt service, Redis hot copy, PG write-behind)

Depends: T05
Read: 01-FEATURES F2, 02-ARCHITECTURE A3, A6 (`sp:*`), A8 (text hot path)

Build:
- `rt/space/index.ts`: `/space` namespace; middleware = space resolver (cookie). On connect join room `space:<id>`, `socket.data = {spaceId, deviceId}`. Typed generics from shared.
- `rt/lib/socket-rate.ts`: per-socket token bucket (20/s, burst 40) wrapper for handlers.
- `core/redis/lua/text_update.lua` use: validate length ≤ TEXT_MAX, `HSET sp:{id}:text c rev+1`, `SADD sp:dirty`, refresh TTL, return rev.
- `rt/space/text.ts`: `text:update` with ack `{rev}` | `{error}`; broadcast `text:changed` to room except sender.
- `rt/text-flusher.ts`: every `TEXT_FLUSH_MS` `SPOP sp:dirty` batch (≤ 100), read hash, seal with space key, one batched upsert in a tx with `SET LOCAL synchronous_commit = off`; on failure re-add ids + exponential backoff; on SIGTERM flush everything before exit.
- `api/modules/text`: `GET /api/text` → Redis hash, else PG decrypt + repopulate hot copy.

Acceptance: integration with two `socket.io-client`s against two rt instances (cluster): A update → B receives `text:changed`; `GET /api/text` returns latest before flush; after flush PG row is sealed (not plaintext) and rev matches; oversize → ack error `TEXT_TOO_LARGE`; kill -TERM rt → no dirty ids left.

Do NOT: send diff protocol; full content only.
