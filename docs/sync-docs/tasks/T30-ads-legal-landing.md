# T30 — Ads, legal pages, landing content

Depends: T29, T25
Read: 01-FEATURES F11, 02-ARCHITECTURE A13 (CSP ad origins)

Build (frontend):
- `components/ads/AdSlot.vue`: props `slot`; fetches `/api/ads` once (store); renders reserved-height box (min-height per slot) then injects html via isolated `<iframe srcdoc sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin">` OR AdSense `<ins>` + loader (lazy, after `requestIdleCallback`); never on `/c/*`, `/chat`, `/link`.
- Place slots: layout top-banner (desktop), sidebar (blog desktop), in-article (after 3rd paragraph via component split), footer.
- CSP: extend frontend Nitro headers for ad origins (`pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`, `tpc.googlesyndication.com`) only on non-chat routes (routeRules headers).
- `pages/privacy.vue`, `pages/terms.vue`: html from `/api/site`, swr 86400.
- Landing content on `/` under editor (SSR): H1 "Share text and files across your devices" (uses APP_NAME), 3-step how it works, short sections: Files go device-to-device, Secure Chat teaser link, Link devices; FAQ-like `details` 4 items (NOT separate FAQ page); JSON-LD `WebApplication`.
- `public/ads.txt` from env/site setting (Nitro route).

Acceptance: ads hidden when space adsDisabled; CLS = 0 with ads; chat routes contain no ad script.
