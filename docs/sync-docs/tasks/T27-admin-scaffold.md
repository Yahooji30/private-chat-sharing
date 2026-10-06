# T27 — Admin app scaffold

Depends: T26
Read: 00-MASTER §5 (UI rules), 01-FEATURES F10

Build (`admin/`, Vue 3 + Vite + vue-router + Pinia + Tailwind 4):
- Dev proxy `/api` → :4000 (vite server.proxy). Prod served same-origin at admin.<domain> with nginx `/api` proxy.
- `src/api.ts`: fetch wrapper (credentials include, auto `x-csrf` from cookie, 401 → redirect login).
- `stores/auth.ts`, router guard, routes: `/login`, `/` dashboard, `/articles`, `/articles/:id`, `/categories`, `/tags`, `/media`, `/reports`, `/ads`, `/settings`, `/admins`, `/audit`, `/account` (password, TOTP setup).
- Layout: collapsible sidebar, top bar (admin name, logout), dark/light, toast + confirm dialog components, data table component (sort, paginate, search), form components.
- `pages/Login.vue` (+ TOTP step), `pages/Account.vue` (change password, TOTP setup with QR via `qrcode`).
- Register only routes built in this task (login, dashboard shell, account). T28/T29 add theirs. No placeholder pages.

Acceptance: login, TOTP enable, logout, guarded redirect work against backend.
