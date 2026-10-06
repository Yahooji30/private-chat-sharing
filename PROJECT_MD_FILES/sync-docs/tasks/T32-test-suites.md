# T32 — Test suites

Depends: T31
Read: each feature's Acceptance lines in tasks T05–T31

Goal: consolidate + fill gaps; CI-ready.

Build:
- Backend: vitest config with real PostgreSQL (per-worker schema) + real Redis (per-worker db index) + test app factory (`test/helpers.ts`: buildApp with fake IP via `x-forwarded-for`, cookie jar, socket client helper). Coverage ≥ 80% lines for `modules/*/service.ts`, `lib/*`.
- Frontend unit: vitest + happy-dom for utils, crypto, webrtc protocol/queue, stores.
- E2E Playwright (`e2e/`): projects chromium + firefox + webkit mobile viewport. Specs: text-sync (2 contexts), presence, files-p2p (3 contexts, holder handoff), link-code, settings-live, public-page, chat (4 + full + rejoin-empty + lockout), blog-render, admin-publish flow. Start stack via `webServer` (api + rt as 2 instances each + nuxt build preview + admin preview) with temp schema/db index.
- Root `pnpm test` runs all; `pnpm test:e2e` separate.
- `.github/workflows/ci.yml`: postgres + redis service containers, install, lint, typecheck, unit, e2e (chromium only) on push.
- Cross-process cases: socket on rt instance 1 receives events emitted from api and from rt instance 2; chat resume across instances; Redis flush mid-run empties chat rooms but not rooms table.

Acceptance: all green locally and in CI.
