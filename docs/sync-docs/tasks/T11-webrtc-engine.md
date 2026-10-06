# T11 — WebRTC peer + resumable block transfer engine (frontend lib + workers)

Depends: T10
Read: 01-FEATURES F3 (Concepts, Download flow, Limits, Connectivity)

Build in `frontend/app/lib/webrtc/` and `frontend/app/workers/` (framework-free TS; Vue only in composable):
- `peer.ts`: `PeerManager`, one RTCPeerConnection per remote deviceId; perfect negotiation (polite = lexicographically smaller deviceId); ICE servers from `/api/rtc/ice` (cached until expiry); signaling via injected `send(to,data)` / `onSignal`; connect timeout 15 s → `ICE_FAILED`; ICE restart on `iceconnectionstatechange: failed` and on `online` event; close idle peers after 60 s; `bye` on unload. One ordered reliable DataChannel `xfer` per peer.
- `protocol.ts`: control JSON `{t:'meta'|'have'|'get'|'cancel'|'err', fileId, ...}`; binary frames: type byte + 16 B fileId + 4 B block + 4 B chunkIdx + payload (type 1 = block chunk, type 2 = hash-list chunk). Chunk size `min(64 KiB, sctp.maxMessageSize)`. Encode/decode unit-tested.
- `bitmap.ts`: compact bitmap (Uint8Array) with set/has/count/missing iterator, base64 (de)serialize.
- `store/` : `BlockStore` interface (`readBlock(fileId, i)`, `writeBlock(fileId, i, bytes)`, `state`, `delete`, `clear`, `estimate`). `OpfsStore` runs in `workers/transfer.worker.ts` using `FileSystemSyncAccessHandle` (preallocate with `truncate(size)`, positioned writes, `flush`), state at `files/<fileId>/state.json` debounced 500 ms + on `pagehide`. `MemoryStore` fallback (no resume across reload). Source reads for a picked-but-not-yet-copied file via `Blob.slice`.
- `hash.worker.ts`: per-block SHA-256 (WebCrypto `digest` on each 1 MiB slice), progress events, `rootHash`.
- `sender.ts` (serving side): answers `meta` (hash list from sidecar `hashes.bin` or recomputes), `have` (own bitmap, resend on change), `get` (reads block, sends chunks honoring `bufferedAmount` pause > 8 MiB, resume at `bufferedamountlow` 1 MiB).
- `downloader.ts`: per file state machine `idle|preparing|downloading|paused|verifying|done|error`. Scheduler: window 8 blocks per peer (cap 24 total), rarest-first then lowest index, reassign blocks of a dropped peer, 3 hash failures → peer marked bad for the file. Verify block SHA-256 before write. Auto-resume on peer/holders change and on page load when `state.json` exists. Progress {bytes, bps, eta, sources}.
- Concurrency queue: max 3 active files per device.
- `composables/useTransfers.ts`: reactive wrapper.

Acceptance: vitest for protocol, bitmap, scheduler (simulated peers incl. corrupt block, dropped peer, out-of-order). Playwright (2-3 contexts, localhost): 200 MB file transfers and hashes match; kill peer connection mid-transfer → resumes, no verified block re-sent; reload receiver mid-transfer → resumes from state; two holders serve different blocks in parallel.

Do NOT: UI (T12/T13). No third-party WebRTC libs.
