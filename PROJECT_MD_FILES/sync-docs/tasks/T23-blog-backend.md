# T23 — Blog backend

Depends: T04, T17 (markdown lib, revalidate lib)
Read: 01-FEATURES F9, 02-ARCHITECTURE A5 (articles, categories, tags, article_tags, tsvector search), A7 (blog routes)

Build `modules/blog/`:
- `service.ts`: create/update article → slugify (unique, suffix -2..), render html (markdown lib + heading ids), TOC json (h2/h3), reading_min (words/200), status transitions (draft → scheduled requires publish_at > now; publish sets published_at once).
- Public routes (published only, cache headers `s-maxage=60`):
  - `GET /api/blog/articles?page&category&tag&q` (12/page, list fields only).
  - `GET /api/blog/articles/:slug` (+ category, tags, cover variants, author name, 3 related).
  - `GET /api/blog/categories`, `GET /api/blog/tags/:slug`.
  - `GET /api/sitemap-data`, `GET /api/blog/rss-data` (latest 30).
- Admin routes (guarded by T26 plugin; register here, guard import later — if T26 not done, put admin routes in `admin.routes.ts` registered only when plugin present): CRUD articles, categories, tags; on change → revalidate paths (`/blog`, `/blog/<slug>`, category/tag pages, `/sitemap.xml`, `/rss.xml`).
- Scheduler already in T04 job → also trigger revalidate.

Acceptance: integration tests: draft invisible publicly; scheduled publishes via job fn; slug uniqueness; pagination.
