# T15 — Link UI

Depends: T14, T07
Read: 01-FEATURES F5

Build:
- `components/link/LinkGenerator.vue`: Generate → QR (`qrcode` to canvas, high contrast, 220px) + code `XXXX-XXXX` + 5-min countdown ring + Copy link + Regenerate on expiry.
- `pages/link.vue` (ssr false): 8-box code input (auto-advance, paste whole code, auto-uppercase), reads `?c=` and auto-submits; Scan QR button → `qr-scanner` camera modal (lazy import, permission errors handled); success → toast + redirect `/`.
- `components/link/LinkedList.vue`: devices + networks lists with Unlink (confirm). Add network form (IP input, validation message from API).
- Client handles `link:revoked` / `space:switch` → reload app state.

Acceptance: phone (other network) scans QR → lands on `/` with same text; unlink from desktop → phone falls back to own space within 2 s.

Do NOT: settings page shell (T16 mounts these components).
