# T13 — Download manager: resume, multi-source, preview, save, zip all, delete

Depends: T12
Read: 01-FEATURES F3 (Download flow, Other actions, Limits, Connectivity)

Build (frontend):
- Download action wires `downloader.ts` (T11): Start, Pause, Resume, Cancel; progress bar with bytes, speed, ETA, sources count; per-file state persisted so a reload shows `Paused` or auto-resumes.
- Auto-resume triggers: holder/partial online event, ICE restart success, page load with existing `state.json`.
- On done → `files:holder`.
- Save to disk: `showSaveFilePicker` + stream from the OPFS file when available, else Blob URL from the OPFS `File` (disk-backed), revoke after.
- `components/files/PreviewModal.vue`: image, video, audio, pdf (iframe of blob URL), text (≤ 1 MB, `<pre>`), else "No preview". Works from partial data only after done.
- Download all: fetch missing (queue), then `client-zip` `downloadZip()` streaming → save.
- Delete one / Clear all (confirm modal) → events → every device deletes OPFS data + state.
- Error UX: ICE_FAILED message from F3; per-peer failures shown as "Source unreachable"; retry; hash failure message after 3 strikes with all sources.
- Size guard: reject add > FILE_MAX_* with toast.
- Startup GC: delete OPFS dirs not in manifest.

Acceptance: Playwright: A shares 50 MB, B downloads, mid-way B goes offline 5 s then returns → resumes without restarting; B reloads mid-way → resumes; B finishes and becomes holder; A offline, C downloads from B; zip contains all files; delete removes from all devices' OPFS.

Do NOT: server fallback storage (decision D2).
