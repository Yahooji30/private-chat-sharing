# T28 — Admin blog + media screens

Depends: T27, T23, T24
Read: 01-FEATURES F9, F10 (Articles, Categories, Tags, Media)

Build (admin):
- `/articles`: table (title, status badge, category, published/scheduled date, updated), filters (status, category), search, New.
- `/articles/:id` editor: title, slug (auto from title, editable, lock icon), excerpt, markdown editor (textarea with toolbar: bold, italic, h2, h3, link, list, code, quote, image from media picker) + side-by-side live preview (server render endpoint `POST /api/admin/articles/preview` → html; debounce 500 ms), cover + OG pick (media picker modal), category select, tags multi (create inline), SEO title/description with char counters + Google snippet preview, status: Save draft / Publish / Schedule (datetime) / Archive. Autosave draft every 20 s if dirty; leave-page guard.
- `/categories`, `/tags`: inline CRUD tables.
- `/media`: grid, drag-drop upload with progress, alt edit, copy URL (largest variant), delete (409 message), media picker reused by editor.

Acceptance: write article with image → publish → visible on frontend blog within seconds (revalidate).
