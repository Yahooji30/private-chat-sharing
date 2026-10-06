# T19 — Chat crypto lib (client)

Depends: T07
Read: 02-ARCHITECTURE A4, 01-FEATURES F8 (Security)

Build `frontend/app/lib/crypto/`:
- `encoding.ts`: base64url ↔ bytes, utf8.
- `chat.ts`:
  - `newSalt(): Uint8Array(16)`
  - `deriveRoomKeys(password, salt, roomCode): Promise<{authKey: string /*b64url*/, encKey: CryptoKey}>` per A4 (PBKDF2 600k → HKDF split; encKey non-extractable).
  - `encryptMsg(encKey, roomCode, text) → {iv, ct}` b64url; `decryptMsg(...) → string | null` (null on failure, never throws to UI).
  - `passwordStrength(pw): 0..4` (length + char classes + common list top 200 embedded small).
- Run derivation in a Web Worker (`chat.worker.ts`) so UI does not freeze; expose promise API.

Acceptance: vitest (happy-dom/node webcrypto): roundtrip, wrong key → null, AAD mismatch (other room code) → null, same password+salt → same authKey, different salt → different.

Do NOT: any network code.
