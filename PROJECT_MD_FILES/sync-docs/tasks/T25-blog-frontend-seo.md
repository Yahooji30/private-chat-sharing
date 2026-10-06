# T25 — Blog frontend + SEO

Depends: T23, T24, T18 (revalidate route)
Read: 01-FEATURES F9, 02-ARCHITECTURE A12

Build:
- `pages/blog/index.vue`: hero featured (latest), grid cards (cover webp `srcset`, title, excerpt, date, reading time), category chips, pagination via `?page` (SSR, rel prev/next).
- `pages/blog/[slug].vue`: article layout (max 72ch), sticky TOC desktop / collapsible mobile, cover with width/height (no CLS), tags, related, share links (X, Facebook, LinkedIn, WhatsApp, copy link — plain anchors), in-article ad slot placeholder component (T30 fills).
- `pages/blog/category/[slug].vue`, `pages/blog/tag/[slug].vue`.
- SEO: `useSeoMeta` everywhere, canonical, OG image = cover 1600 variant or default; JSON-LD `Article` + `BreadcrumbList` (`useHead` script type ld+json); `@nuxtjs/sitemap` source from `/api/sitemap-data`; `@nuxtjs/robots` (disallow /settings, /link, /c/, /chat, /public/); `server/routes/rss.xml.ts` RSS 2.0.
- Prose styles for rendered html (`.prose` custom, light/dark).
- routeRules swr 600 for blog (A12).

Acceptance: view-source of article has full content + JSON-LD; sitemap lists articles; Lighthouse SEO 100, perf ≥ 95 mobile; publish in admin → page updates without waiting 10 min.
