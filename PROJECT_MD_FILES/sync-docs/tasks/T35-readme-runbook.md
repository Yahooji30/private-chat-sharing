# T35 — README + ops runbook

Depends: T34
Read: 00-MASTER, 04-DEPLOY

Build:
- `README.md`: what it is, stack, repo layout, local dev (prereqs, `.env`, `pnpm dev`, ports), tests, build, env reference table, how to rename product (APP_NAME + manifest icons + legal text).
- `docs/RUNBOOK.md`: deploy, rollback, backup/restore, rotate secrets (MASTER_KEY rotation note: requires re-seal script `backend/scripts/reseal.ts` — include script), enable TURN, add admin, reset admin 2FA (CLI script `backend/scripts/admin-reset.ts`), view logs, common incidents (sockets failing behind proxy, P2P failing → TURN, disk full, high memory, Redis down or restarted = chat rooms emptied by design, `evicted_keys` rising → raise maxmemory, PG connection exhaustion, flusher backlog `SCARD sp:dirty`), scale path (managed PG and Redis via env, more api/rt instances behind a load balancer).
- `docs/PRIVACY-NOTES.md`: what is stored (hashed IP, encrypted text, file metadata, room verifier), what exists only in RAM temporarily (chat ciphertext in Redis, wiped when room empties, never on disk), what is never stored (files, plaintext chat, raw IP, passwords) — input for client's privacy policy.

Acceptance: new dev can run project from README alone; scripts run.
