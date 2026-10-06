# T09 — Presence

Depends: T08
Read: 01-FEATURES F4, 02-ARCHITECTURE A8 (presence)

Backend (rt):
- `rt/space/presence.ts`: on `/space` connect/disconnect, debounce 250 ms per space then `io.of('/space').in('space:<id>').fetchSockets()` (adapter, works across instances), collapse sockets by deviceId, join with device names/types (Redis resolve cache), emit `presence:list` to room.
- Device rename (PATCH /api/device in api) → emitter publishes a refresh → rt re-emits list.
- Update `devices.last_seen_at` on last socket of a device disconnecting (batched, throttled).
- Per-instance socket counts to `rt:stats:{pid}` every 5 s (TTL 15 s) for admin dashboard.

Frontend:
- `stores/presence.ts`, `components/presence/PresenceBar.vue` (dots + count in top bar), `PresenceSheet.vue` (list, "This device" tag, type icon, rename own inline).

Acceptance: 3 tabs (2 same device) across two rt instances → list shows 2 devices; closing a tab updates others within 1 s; kill one rt instance → list corrects after clients reconnect.

Do NOT: show IPs or location; store presence in Redis keys.
