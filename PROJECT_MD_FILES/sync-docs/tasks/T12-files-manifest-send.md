# T12 — File manifest + share (upload) flow + file list UI

Depends: T11
Read: 01-FEATURES F3 (Concepts, Share flow), 02-ARCHITECTURE A5 (file_entries, file_holders), A8 (files events)

Backend:
- api: `GET /api/files` → entries (decrypted meta) + holders + `ready` flag.
- rt `files` handlers: `files:add` (array ≤ 20, `rootHash` null, enforce FILES_MAX per space → `FILES_LIMIT`), `files:ready {fileId, rootHash}` (only the adder, rootHash 64 hex, set once), `files:remove`, `files:clear`, `files:holder` (only self deviceId, only if entry ready); broadcast events; `expires_at = now + 7 d`; PG writes via `core` repo.
- thumb ≤ 32 KB data URL `image/webp|jpeg` only, validated.

Frontend:
- `stores/files.ts`: manifest + holders + local state (`preparing`, `copying`, `local`, `needs-reselect`) + availability (holder/partial online via presence + files:holders).
- `components/files/FilesDrawer.vue` (side sheet desktop, bottom sheet mobile): drop zone, pick, paste-to-upload on home, list rows: thumb/icon, name, size, sender device, status (Preparing n% / Available / Waiting for X / Downloading n% / Paused / Done), actions.
- `utils/thumbnail.ts`: image → webp 160px via OffscreenCanvas/canvas.
- Share flow per F3: add entry → hash in worker → `files:ready` → background copy to OPFS (serve from `File` meanwhile) → `files:holder`. Quota check via `navigator.storage.estimate()`; MemoryStore notice banner. `needs-reselect` flow verifies name+size+rootHash.
- Auto-download setting (per device, default on) → enqueue downloads for new ready entries < 50 MB when a source is online (T13 downloader).

Acceptance: device A adds 3 files → B sees list instantly (Preparing then ready); limit 100 enforced; reload A mid-hash → entry resumes via re-select; reload A after done → still holder from OPFS.

Do NOT: download manager, preview, zip (T13).
