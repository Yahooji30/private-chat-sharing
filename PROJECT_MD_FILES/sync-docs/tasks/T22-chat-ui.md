# T22 — Chat UI

Depends: T19, T21
Read: 01-FEATURES F8 (all UI rules), 00-MASTER §5

Build (ssr false, no ads on these routes):
- `pages/chat/index.vue` (route `/chat`): intro (short, how it works: 4 people max, E2EE, nothing saved), Create form: password + confirm + strength meter, optional custom code, Create → worker derive → POST → result card: link (copy, QR, `navigator.share`), manage token (copy, "keep private"), "Password is not in the link — send it separately", Enter room button. Join form: code input → go `/c/CODE`.
- `pages/c/[code].vue`: password gate → salt → derive → ticket → connect `/chat` with ticket. States: deriving (spinner "Securing…"), locked (retry countdown), wrong password, full (4/4 screen), closed by owner, disconnected: socket.io auto-reconnect sends `resume {code, token, lastId}` while keys are in memory (gap within grace → missed messages appear, status line "Reconnecting"); after grace or on reload the user must enter the password again and starts with an empty screen.
- Chat view: header (room code, members dots 4 colored, Leave & wipe), message list (bubbles: own right; others left colored by palette slot; system lines centered muted), composer (auto-grow textarea, Enter send, Shift+Enter newline, 2000 counter), typing indicator dots with slot color.
- Messages in component state only (no Pinia persistence, no storage). Wipe array + drop keys on leave, `pagehide`, route leave.
- Privacy: optional blur overlay on `visibilitychange` hidden (device setting). `autocomplete="off"`, no link previews; links in messages plain text clickable with rel noopener nofollow.
- Manage modal (if user pastes manage token): delete room / change password.

Acceptance: Playwright 4 contexts chat; 5th gets full; one leaves + rejoins → empty history; refresh → empty; wrong password ×5 → lock screen.
