# T31 — PWA

Depends: T30
Read: 01-FEATURES F11 (PWA)

Build:
- `@vite-pwa/nuxt`: registerType autoUpdate, manifest (name APP_NAME, short_name, theme/bg colors from tokens, display standalone, icons 192/512 + maskable, shortcuts: Chat, Settings).
- Workbox: precache app shell + `_nuxt` assets; runtime: blog pages StaleWhileRevalidate, `/media/*` CacheFirst 30 d max 200; NEVER cache `/api/*`, `/socket.io/*`, `/c/*`, `/p/*` edit routes.
- Offline fallback page `offline.vue` (static).
- `share_target` (POST multipart, files + text) → service worker handler stores into Cache/IDB temp → opens `/` → app picks up and runs add-files / append text flow, then deletes temp.
- Update toast "New version available" → reload.
- Icons generated from single SVG (`@vite-pwa/assets-generator`).

Acceptance: Lighthouse PWA installable; offline shows fallback; Android share image into app → appears in files list.
