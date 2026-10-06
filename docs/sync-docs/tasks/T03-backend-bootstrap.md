# T03 — Backend bootstrap

Depends: T02
Read: 00-MASTER §3 (backend layout), 02-ARCHITECTURE A0, A1, A2, A13

Build:
- `core/config/env.ts`: zod-parse process.env (A1), fail fast with readable error.
- `core/db/client.ts`: `postgres` driver pool (`PG_POOL_MAX`), Drizzle instance, `closeDb()`, `pingDb()`.
- `core/redis/client.ts`: ioredis factories: `createRedis()` (commands), `createSubscriber()` (adapter pub/sub); `maxRetriesPerRequest` null for adapter, reconnect backoff, `pingRedis()`.
- `core/redis/keys.ts`: typed key builders for every key in A6 (empty usage ok now), `core/redis/lua/` loader with `EVALSHA` + fallback `EVAL`.
- `core/lib/ip.ts`: `normalizeIp` (v4, v6 /64, v4-mapped) + `hashIp` (HMAC). Unit tests.
- `core/lib/crypto.ts`, `core/lib/ids.ts` per A3. Unit tests (seal/open roundtrip, tamper fails).
- `core/lib/cache.ts`: lru-cache factory (derived keys only).
- `core/errors.ts`: `ApiError`, mapping to shared codes.
- `api/server.ts`: Fastify 5 with `trustProxy`, zod type provider, pino logger (redact: req.ip, cookies, authorization, body), `@fastify/helmet` (CSP per A13), `@fastify/cookie`, `@fastify/rate-limit` (Redis store, keyGenerator = ipHash), `@fastify/cors` (ADMIN_ORIGIN only, credentials), error-handler plugin → `{error:{code,message}}`.
- `GET /api/health` → `{ok, pg, redis, uptime, rssMb}` (503 if pg or redis down).
- `api/server.ts` + `rt/server.ts` listen on 127.0.0.1 (`API_PORT`, `RT_PORT`), graceful shutdown on SIGTERM (stop accepting, drain, close pg + redis). rt: Socket.IO server skeleton with `transports: ['websocket']`, `@socket.io/redis-adapter`, no namespaces yet.

Acceptance: `curl /api/health` 200 with both true; stop Redis → 503; rt accepts a websocket handshake on :4001; tests pass; bad env → exit 1 with message.

Do NOT: add schema or modules yet.
