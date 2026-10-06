# T04 — PostgreSQL schema, migrations, Redis keys + Lua, cleanup jobs

Depends: T03
Read: 02-ARCHITECTURE A5, A6, A9, A10 (Lua scripts only)

Build:
- `core/db/schema.ts`: all tables from A5 (Drizzle pg-core) with indexes, fk `onDelete: cascade` for children of spaces/articles/pages/files, `articles.search` generated tsvector + GIN.
- `drizzle.config.ts`, scripts `db:generate`, `db:migrate` (separate script, NOT run at app boot).
- `core/redis/keys.ts`: complete builders for A6 (all keys, TTL constants beside them).
- `core/redis/lua/`: `text_update.lua`, `chat_join.lua`, `chat_free.lua`, `chat_wipe_if_empty.lua` per A8/A10 (logic filled in T06 and T21; here create files with full working bodies + unit tests against real Redis).
- `jobs/cleanup.ts`: `startJobs()` inside api: setInterval(...).unref(); each run wrapped by `SET lock:jobs:<name> NX EX`; tasks per A9 as separate exported functions (scheduled-article publish, expired file entries, inactive spaces 90 d, chat_rooms 365 d, expired admin sessions).
- Admin bootstrap: on api boot, if no admins and ADMIN_BOOTSTRAP_* set → create owner (argon2id).

Acceptance: fresh DB migrates; job functions tested against real PG (test schema) : expired rows deleted, active kept; two parallel job runs → only one executes (lock); Lua scripts tested.

Do NOT: add routes.
