# T26 — Admin auth backend

Depends: T04
Read: 01-FEATURES F10 (Login, Admin users, Audit), 02-ARCHITECTURE A5 (admins, admin_sessions, audit_log), A7 (admin), A13

Build `modules/admin/` + `plugins/admin-auth.ts`:
- `POST /api/admin/auth/login {email, password}` → lockout (5 fails/15 min per account + 5/15 min per ipHash) → argon2 verify → if TOTP enabled return `{totpRequired, pendingToken}` (5 min) else session.
- `POST /api/admin/auth/totp {pendingToken, code}` (otplib, window ±1).
- Session: 32-byte token, cookie `sid_adm` httpOnly Secure SameSite=Strict path `/api/admin`, DB sha256, 12 h sliding (extend when < 6 h left). CSRF: cookie `csrf_adm` (readable) + header `x-csrf` must match on non-GET.
- `GET auth/me`, `POST auth/logout`, `POST auth/logout-all`, `POST auth/totp/setup` (returns otpauth URL + QR data), `POST auth/totp/enable {code}`, `POST auth/password {old,new}`.
- Admins CRUD (owner only), cannot delete last owner.
- `plugins/admin-auth.ts`: preHandler for `/api/admin/*` except login/totp → attaches `req.admin`; role guard helper.
- `lib/audit.ts`: `audit(adminId, action, target)` used by all admin mutations (wire into T23/T24 admin routes now).
- Wire previously deferred admin routes from T23/T24 behind this plugin.

Acceptance: integration: no cookie → 401; CSRF missing → 403; lockout; TOTP flow; session expiry.
