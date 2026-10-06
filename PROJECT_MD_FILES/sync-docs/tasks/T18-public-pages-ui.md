# T18 — Public pages UI

Depends: T17, T07
Read: 01-FEATURES F7, 02-ARCHITECTURE A12

Build:
- `pages/public/index.vue`: my pages list (title, /p/slug copy, views, updated), New button, empty state.
- `pages/public/new.vue` + `pages/public/[slug]/edit.vue`: shared `PublicPageForm.vue` (title, slug with availability hint, markdown textarea + live preview using lazy `markdown-it` client-side for preview only, indexable toggle). After create: modal showing link + edit token (copy, warning "shown once").
- `pages/p/[slug].vue` (SSR, swr 300): clean reading layout, `useSeoMeta` (title, description from first 160 chars, robots noindex unless indexable), Report link → modal → POST.
- 404 page styling for missing slug.
- `server/routes/_revalidate.post.ts` (Nitro): verify header `x-revalidate-secret`, body `{paths:string[]}` → remove cached route keys. (Shared by blog in T25.)

Acceptance: publish → open /p/slug in private window renders SSR html; edit via token from other network works; noindex meta present by default.
