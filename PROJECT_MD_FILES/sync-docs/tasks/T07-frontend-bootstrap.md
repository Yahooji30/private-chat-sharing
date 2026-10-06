# T07 — Frontend bootstrap

Depends: T02 (T06 for live test)
Read: 00-MASTER §5 (UI rules), 02-ARCHITECTURE A12

Build (Nuxt 4, `app/` dir):
- Modules: `@nuxtjs/tailwindcss` NOT used → Tailwind 4 via `@tailwindcss/vite`; `@pinia/nuxt`; `@vueuse/nuxt`.
- `nuxt.config.ts`: runtimeConfig (A1 frontend), routeRules (A12), dev proxy `/api` → :4000 and `/socket.io` → :4001 (nitro devProxy, ws true), app head defaults, compatibilityDate.
- Design tokens `assets/css/main.css`: Tailwind 4 `@theme` with CSS vars for light/dark (bg, surface, text, muted, primary, accent, success, danger, 4 chat bubble colors). Visual direction: clean, app-like, soft rounded (12–16px), subtle shadows, one bold accent gradient for primary actions. System font stack + optional mono.
- `layouts/default.vue`: sticky top bar (logo text APP_NAME, nav: Home, Chat, Blog, Public, Settings icon), presence slot, content, footer (Privacy, Terms, Blog). Mobile: bottom tab bar (Home, Chat, Public, Settings).
- `composables/useApi.ts`: `$fetch` wrapper, base `/api`, credentials include, maps error shape → typed `ApiError`.
- `plugins/socket.client.ts`: lazy `useSpaceSocket()` singleton (socket.io-client, `/space`, auto reconnect, exposes `connected` ref).
- `stores/space.ts`: me (spaceId, device), load via `/api/space/me`.
- `composables/useTheme.ts`: system/light/dark, localStorage, no flash (inline head script sets `data-theme` before paint).
- `components/ui/`: Button, IconButton, Toggle, Modal, Toast (+ `useToast`), Input, Slider, Tabs, Spinner. Icons: `@iconify/vue` limited set OR inline SVG components (pick inline SVG to avoid network).
- `pages/index.vue` placeholder layout region only (editor comes T08).

Acceptance: `pnpm dev` → home renders SSR shell, theme toggle works, socket connects (devtools ws), Lighthouse mobile perf ≥ 95 on `/`.

Do NOT: build editor, files, chat pages.
