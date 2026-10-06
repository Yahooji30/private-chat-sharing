# T24 — Media upload backend (blog only)

Depends: T23
Read: 01-FEATURES F10 (Media library), 02-ARCHITECTURE A5 (media), 04-DEPLOY D6 (/media)

Build `modules/media/` (admin only):
- `@fastify/multipart` limit 10 MB, 1 file; sniff type by magic bytes (`file-type`), allow jpeg/png/webp/gif.
- `sharp`: strip metadata, auto-rotate, output webp variants widths [480, 960, 1600] (no upscale) + original-size webp; filenames `<id>-<w>.webp` in MEDIA_DIR/yyyy/mm/.
- DB row with variants_json `[{w,h,path,bytes}]`, alt.
- `GET /api/admin/media?page`, `PATCH /:id {alt}`, `DELETE /:id` (409 if referenced by article cover/og).
- sharp concurrency 1 (`sharp.concurrency(1)`) to protect small VPS.

Acceptance: upload png → 4 webp files on disk + row; non-image rejected; delete blocked when used.
