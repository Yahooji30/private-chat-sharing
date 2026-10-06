# T17 — Public pages backend

Depends: T05
Read: 01-FEATURES F7, 02-ARCHITECTURE A5 (public_pages, page_reports), A6 (`pv:*`), A7

Build:
- `lib/markdown.ts`: markdown-it (linkify, no html input) → sanitize-html allowlist (headings, p, a[href,rel], lists, code/pre, blockquote, table, img[src https/data? no → https only], hr, strong/em); external links `rel="nofollow noopener noreferrer" target="_blank"`. Unit tests (xss vectors).
- `modules/public-pages/`:
  - `GET /api/public-pages` (mine by space).
  - `POST` {title 1–120, body ≤ 50k, slug?, indexable} → slug unique (reserved words list: admin, api, blog, chat, p, public, settings, link, privacy, terms) → returns page + `editToken` once.
  - `PUT/DELETE /:slug` authorized by owner space OR header `x-edit-token`.
  - `GET /api/p/:slug` public (published only) → title, html, indexable, updatedAt; view count increment deduped (Redis `SET pv:{slug}:{ipHash} NX EX 86400`).
  - `POST /api/p/:slug/report {reason ≤ 500}` rate-limited 3/h/ip.
- Rate limit create 10/h/space. After create/update/delete → call frontend revalidate (`lib/revalidate.ts`, fire-and-forget, 2 s timeout).

Acceptance: integration tests for ownership, token edit, slug conflict, XSS sanitized.
