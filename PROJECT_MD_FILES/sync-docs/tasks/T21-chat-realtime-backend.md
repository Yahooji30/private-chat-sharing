# T21 — Chat realtime (rt): Redis stream relay, slots, resume, wipe

Depends: T20, T06 (rt server)
Read: 01-FEATURES F8 (steps 4-6, History and storage rules), 02-ARCHITECTURE A6 (`chat:*`), A8 (/chat), A10 (all)

Build `rt/chat/`:
- Namespace `/chat`, middleware: `handshake.auth.ticket` → `GETDEL chat:ticket:{sha256}` → code (new join); or `handshake.auth.resume {code, token, lastId}` (resume). Else `Error('UNAUTHORIZED')`.
- Join via Lua `chat_join.lua` (atomic): free slot or FULL (emit `chat:full`, disconnect). Stores `sha256(resumeToken)|live`, sets palette on new session, returns `{slot, tailId}`. Join socket to room `chat:<CODE>`. Emit `chat:members {count, slot, slots, color, resumeToken}` to self; broadcast members + `chat:system joined` to others. Cursor = `tailId` so joiners see no history.
- `chat:msg {iv, ct}`: zod (b64url, decoded ct ≤ 8 KB), per-socket rate 10/s → `XADD chat:{CODE}:msgs MAXLEN ~ CHAT_MSG_CAP * slot iv ct` → broadcast `{id, slot, iv, ct}` to others via adapter. Refresh idle TTL on all room keys.
- `chat:typing {on}` → relay with slot (throttle 1/s).
- Resume: verify token hash on slot in `grace|live` state → state live, `XRANGE (lastId +` replay missed to this socket only, continue.
- Abrupt disconnect: slot → `grace`, `ZADD chat:grace now+CHAT_RESUME_GRACE_S CODE:slot`, broadcast `chat:system left` after grace only if not resumed (or immediately show nothing). Sweeper (every 10 s per rt instance): `ZRANGEBYSCORE` expired → `chat_free.lua` (free slot; if no slots remain `DEL` slots + msgs + meta) → broadcast members.
- `chat:leave`: free slot now via `chat_free.lua`, same empty-wipe rule.
- API-triggered close (T20): socket handler on adapter-delivered `chat:closed` already sent by emitter; nothing else needed here.
- Live counts to `rt:stats:{pid}`: live chat sockets (admin dashboard).

Acceptance (socket.io-client tests, two rt instances): 5th client gets `chat:full`; message from member 1 reaches 2-4 on other instance; rejoin receives zero earlier messages; resume within grace replays exactly the missed messages once; after grace slot is free; all leave → `EXISTS chat:{CODE}:*` is 0; stream never exceeds `CHAT_MSG_CAP`; no key without TTL; no plaintext ever in Redis (ciphertext only).

Do NOT: persist to PG, replay history to joiners, decrypt anything server-side.
