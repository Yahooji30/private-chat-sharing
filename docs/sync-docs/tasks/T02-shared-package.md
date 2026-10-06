# T02 — Shared package

Depends: T01
Read: 00-MASTER §5, 01-FEATURES (limits only), 02-ARCHITECTURE A7, A8

Goal: single source of contracts for backend, frontend, admin.

Build in `shared/src/`:
- `constants.ts`: TEXT_MAX=100000, TEXT_DEBOUNCE_MS=400, FILES_MAX=100, FILE_TTL_DAYS=7, FILE_MAX_OPFS=4GiB, FILE_MAX_MEM=500MiB, AUTO_PUSH_MAX=50MiB, CHUNK=64KiB, BLOCK_SIZE=1MiB, XFER_WINDOW_PER_PEER=8, XFER_WINDOW_TOTAL=24, FILE_CONCURRENCY=3, CHAT_MSG_CAP_DEFAULT=200, CHAT_RESUME_GRACE_S_DEFAULT=120, LINK_CODE_LEN=8, LINK_TTL_MS=300000, CHAT_MAX_MEMBERS=4, CHAT_MSG_MAX_CHARS=2000, CHAT_CT_MAX_BYTES=8192, CHAT_ROOM_TTL_DAYS=365, SPACE_TTL_DAYS=90, PUBLIC_PAGE_MAX=50000, FONT_SIZE_MIN=12, FONT_SIZE_MAX=28.
- `errors.ts`: `ErrorCode` const enum (TEXT_TOO_LARGE, RATE_LIMITED, NOT_FOUND, FORBIDDEN, VALIDATION, ROOM_FULL, ROOM_LOCKED, BAD_PASSWORD, CODE_INVALID, CODE_EXPIRED, SLUG_TAKEN, FILES_LIMIT, UNAUTHORIZED, CSRF, INTERNAL) + `ApiError` type.
- `schemas/`: zod 4 schemas + inferred types per module: `space.ts`, `text.ts`, `settings.ts`, `files.ts`, `link.ts`, `publicPages.ts`, `chat.ts`, `blog.ts`, `admin.ts`, `ads.ts`.
- `events.ts`: socket event name constants (A8, including `files:ready`, `chat:full`, `chat:leave`, chat resume auth shape, block-transfer protocol message types) + typed maps `SpaceServerToClient`, `SpaceClientToServer`, `ChatServerToClient`, `ChatClientToServer` for Socket.IO generics.
- `ids.ts`: Crockford base32 alphabet + `normalizeCode(input)` (uppercase, strip `-`/spaces, map I/L→1, O→0).
- `index.ts` re-exports.

Acceptance: unit tests (vitest) for `normalizeCode` and 3 schema edge cases each for text, chat, link. Build emits esm + d.ts.

Do NOT: put runtime Node or browser APIs here (must run in both).
