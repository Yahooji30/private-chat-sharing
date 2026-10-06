# T16 — Settings backend + UI

Depends: T15
Read: 01-FEATURES F6, 02-ARCHITECTURE A5 (space_settings)

Backend `modules/settings/`:
- `GET /api/settings`, `PUT /api/settings` (partial zod: fontFamily `sans|serif|mono`, fontSize 12–28 int, urlsPanel bool, adsDisabled bool); defaults merge; broadcast `settings:changed`.

Frontend:
- `stores/settings.ts`: space settings (API + socket) + device settings (localStorage: theme, autoDownload, spellcheck, blurOnHide for chat).
- `pages/settings.vue` (ssr false) with Tabs: Appearance (theme, font family preview chips, font size slider with live sample), Editor (URLs panel, auto-download, spellcheck), Ads toggle, Devices (rename, PresenceSheet list), Link Devices (T15 components).
- Help note box: shared-IP limitation (F1 Known limitation), neutral wording.

Acceptance: change font size on A → B editor updates live; device settings stay per device.

Do NOT: Security/password tab.
