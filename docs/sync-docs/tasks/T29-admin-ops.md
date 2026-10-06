# T29 — Admin ops

Depends: T27, T17, T21
Read: 02-ARCHITECTURE A6 (`rt:stats`), 01-FEATURES F10 (Dashboard, moderation, Ads, Site settings, Admin users, Audit), F11 (ad slots)

Backend (`modules/admin/`, `modules/ads/`, `modules/site/`):
- `GET /api/admin/stats`: online devices and live chat sockets (sum of `rt:stats:*` from all rt instances), active chat rooms now (cached 10 s), active spaces 24 h (PG), rooms total (PG), articles by status, public pages, open reports. Counts only.
- Reports: list (page title/slug, reason, count, date), resolve, unpublish/delete page (+ revalidate).
- Ad slots CRUD (keys fixed: top-banner, sidebar, in-article, footer), html sanitized? → NO sanitize (admin trusted) but store + render only inside ad component; global `ads_enabled` site setting.
- Site settings key/value: site_name, tagline, default_og_media_id, social links, analytics_id, privacy_md, terms_md (render html on save). `GET /api/site` public subset. `GET /api/ads` public (respects space adsDisabled + global flag).
- Admins page (owner), audit log list (paginated).

Admin UI pages: Dashboard (stat cards, auto refresh 30 s), Reports, Ads, Settings (tabs General, Legal, Social/Analytics), Admins, Audit.

Acceptance: report from public page appears in queue; unpublish → /p/slug 404 after revalidate; ads toggle reflects in `/api/ads`.
