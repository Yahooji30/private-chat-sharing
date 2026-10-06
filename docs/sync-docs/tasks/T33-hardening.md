# T33 — Security + performance hardening pass

Depends: T32
Read: 00-MASTER §5, 02-ARCHITECTURE A11, A13

Checklist (fix every miss, list fixes at end):
Security
- [ ] Every route + socket event: zod validated, rate-limited, size-capped.
- [ ] No raw IP, message, authKey, ticket, token in logs (grep log calls; run app + inspect output).
- [ ] CSP per route group (app, chat strict, blog+ads, admin); `frame-ancestors 'none'`; HSTS; Referrer-Policy `no-referrer` on /c/*, `strict-origin-when-cross-origin` elsewhere; Permissions-Policy (camera only /link + settings).
- [ ] Cookies flags verified; admin CSRF on all mutations.
- [ ] Space isolation: fuzz test that device of space A can't read/modify/signal B (text, files, rtc, link list, public pages).
- [ ] `pnpm audit --prod` clean; no deprecated deps (`pnpm outdated`).
Performance
- [ ] Frontend: route-level code split; editor, webrtc, qr, markdown-it, client-zip lazy-imported; initial JS on `/` ≤ 120 KB gz; fonts self-hosted subset, `font-display: swap`.
- [ ] Lighthouse mobile ≥ 95 perf on `/`, `/blog`, article, `/chat`.
- [ ] Backend: autocannon `GET /api/text` 2k rps on 2 vCPU p99 < 50 ms; 5k idle sockets across 2 rt instances RSS < 300 MB total, chat fan-out p99 < 100 ms with 1k live rooms (script `bench/` with results in README).
- [ ] PostgreSQL: `EXPLAIN` on hot queries uses indexes; no N+1 in blog lists; pool size within `max_connections`.
- [ ] Redis: every key has TTL (scan script reports keys without TTL except allowed two); `maxmemory` honored; `evicted_keys` 0 under bench; no plaintext chat in `MONITOR`/dump.
- [ ] Nginx gzip/brotli + cache headers verified.

Acceptance: checklist all ticked; bench results recorded.
