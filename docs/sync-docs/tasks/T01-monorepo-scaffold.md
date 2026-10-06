# T01 — Monorepo scaffold

Depends: none
Read: 00-MASTER §2, §3

Goal: empty but buildable pnpm workspace with 4 packages + tooling + local PG/Redis.

Build:
- `pnpm-workspace.yaml` (shared, backend, frontend, admin).
- Root `package.json`: `engines.node ">=24"`, `packageManager pnpm@10.x`, scripts: `dev` (parallel backend api + rt + frontend + admin), `build`, `typecheck`, `lint`, `test`.
- `tsconfig.base.json`: strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2023, moduleResolution bundler.
- `eslint.config.js` flat config shared (typescript-eslint + vue plugin), stylistic rules, no Prettier.
- `.editorconfig`, `.gitignore`, `.nvmrc` (24), `.env.example` (copy A1 from 02-ARCHITECTURE).
- `deploy/dev/docker-compose.yml`: postgres 17 + redis 7 (no persistence), ports 5432/6379 on localhost, dev credentials matching `.env.example`. Dev only.
- `shared/`: package `@sync/shared`, tsup build (esm + d.ts), `src/index.ts` empty export.
- `backend/`: package `@sync/backend`, tsx dev, tsup build with two entries (`src/api/server.ts` → `dist/api.js`, `src/rt/server.ts` → `dist/rt.js`), each prints "ok" only.
- `frontend/`: `pnpm dlx nuxi@latest init` Nuxt 4 minimal, depends `@sync/shared`.
- `admin/`: Vite + Vue 3 TS template minimal, depends `@sync/shared`.
- `docs/` folder (move these .md files into `docs/`).

Acceptance:
- `pnpm i && pnpm -r build && pnpm -r typecheck && pnpm -r lint` all pass.
- `docker compose -f deploy/dev/docker-compose.yml up -d` gives reachable PG + Redis.
- `pnpm dev` starts api, rt, frontend :3000, admin :5173.

Do NOT: add UI, routes, DB schema, extra libs.
