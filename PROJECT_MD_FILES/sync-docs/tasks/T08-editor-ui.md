# T08 — Editor UI

Depends: T06, T07
Read: 01-FEATURES F2, F6 (font/size/urlsPanel only)

Build:
- `components/editor/SyncEditor.vue` (<ClientOnly> in `pages/index.vue`): full-height textarea, font family/size from settings store, spellcheck per device, character counter (red ≥95%).
- `composables/useTextSync.ts`: load GET /api/text; debounce TEXT_DEBOUNCE_MS → emit `text:update` with ack; states `saving|saved|offline`; offline queue (keep latest only) flush on reconnect; on `text:changed` apply only if no pending local change; preserve caret via common prefix/suffix offset mapping (`utils/caret.ts`, unit-tested).
- `components/editor/Toolbar.vue`: SaveState pill, Copy (clipboard + fallback, toast), URLs button (badge count), Files button (opens files drawer, wired in T12), Download all (T13).
- `components/editor/UrlsPanel.vue` + `utils/extractUrls.ts` (regex http/https/www., dedupe, max 200; unit tests). Hidden when settings.urlsPanel=false.
- Keyboard: Ctrl/Cmd+S → force flush (no browser save dialog).

Acceptance: two browser windows → typing in one appears in other < 500 ms; caret stable in receiver when editing elsewhere; offline (devtools) → "Offline", reconnect → saves.

Do NOT: rich text, markdown rendering.
