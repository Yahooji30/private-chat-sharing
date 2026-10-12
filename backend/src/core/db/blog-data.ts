/** Starter blog: informative, search-friendly articles loaded by `pnpm db:seed-blog`. Edit or delete them in Admin > Articles. */
export interface SeedArticle {
  slug: string; title: string; category: string; tags: string[]; excerpt: string; seoTitle: string; seoDescription: string; body: string
}
export const SEED_CATEGORIES = [
  { slug: 'guides', name: 'Guides', description: 'Step-by-step help for sharing text and files between your devices.' },
  { slug: 'privacy-security', name: 'Privacy & Security', description: 'How to keep what you share private, on any network.' },
  { slug: 'tips-tricks', name: 'Tips & Tricks', description: 'Small habits that save time when you work across devices.' },
  { slug: 'technology', name: 'Technology', description: 'How the technology behind instant sharing actually works.' },
]

export const SEED_ARTICLES: SeedArticle[] = [
  {
    slug: 'share-text-between-phone-and-computer', title: 'How to Share Text Between Your Phone and Computer Instantly', category: 'guides',
    tags: ['text sharing', 'phone to pc', 'clipboard'],
    excerpt: 'Copying a link, a note or a code from your phone to your laptop should take a second, not a detour through email. Here are the fastest ways, from simplest to most flexible.',
    seoTitle: 'Share Text Between Phone and Computer Instantly (No Sign-Up)',
    seoDescription: 'Learn the fastest ways to send text, links and notes between your phone and computer without email or cables, and keep every device in sync.',
    body: `You are reading something on your phone and need it on your laptop. A link, a tracking number, a paragraph from a document, a password for a Wi-Fi network. It should take a second. In practice most people email themselves, paste it into a chat app, or retype it. This guide shows quicker and cleaner ways.

## Why moving text between devices is still awkward

Phones and computers were designed as separate worlds. Each has its own clipboard, its own apps and its own accounts. Moving a few words across means finding a channel that both sides can open: email, a messaging app, a cloud note. Every option adds steps, sign-ins or clutter in an inbox you then have to clean up.

## Option 1: A shared scratchpad that updates live

The fastest approach is a single text box that every device shows at the same moment. You type or paste on one device and the text appears on the others, with no refresh and no account.

- Open the same page on both devices while they are on the same Wi-Fi.
- Paste your text on the phone.
- Read or copy it from the laptop.

This is how Jodbox works. Devices on the same network automatically share one space, so there is nothing to pair. It also keeps the last text you saved, so a note you left on your laptop is still there when you pick up your phone.

## Option 2: Message yourself

Many people keep a chat with themselves in a messaging app. It works, but the chat fills up with old items, links get buried, and you need the same app installed and signed in on both devices.

## Option 3: Email yourself

Email is universal and slow. It is fine for something you want to keep, and overkill for a link you will use once.

## Option 4: Built-in clipboard sync

Some phone and computer makers offer a shared clipboard between their own devices. It is convenient inside one brand and does not help when you mix an Android phone with a Windows laptop, or an iPhone with a Linux machine.

## Tips for sharing text safely

1. Do not paste passwords or private keys into a shared space on public Wi-Fi. Anyone on the same network can end up in the same space.
2. Clear the text when you are done. A good tool has a one-tap clear that removes it from every device.
3. For anything sensitive, use an end-to-end encrypted chat room instead of a shared scratchpad.

## What about links?

Links are the most common thing people move between devices. A good shared scratchpad detects web addresses in your text and lists them separately, so you can open a link from your laptop on your phone, or copy it with one tap.

## Quick comparison

| Method | Needs sign-in | Speed | Works across brands |
| --- | --- | --- | --- |
| Shared scratchpad | No | Instant | Yes |
| Message yourself | Yes | Fast | Yes |
| Email | Yes | Slow | Yes |
| Built-in clipboard sync | Yes | Fast | No |

## Summary

For quick, throwaway text, a shared live scratchpad beats every other method: no accounts, no clutter and no waiting. Keep email and chat for things you want to keep.`,
  },
  {
    slug: 'transfer-files-phone-to-pc-without-cable', title: 'How to Transfer Files From Your Phone to a PC Without a Cable', category: 'guides',
    tags: ['file transfer', 'wireless', 'phone to pc'],
    excerpt: 'No cable, no app, no cloud upload. These are the practical ways to move photos, videos and documents between a phone and a computer, and when each one makes sense.',
    seoTitle: 'Transfer Files From Phone to PC Without a Cable (Free, No App)',
    seoDescription: 'Move photos, videos and documents from your phone to a PC wirelessly. Compare cloud, email, Bluetooth and peer-to-peer transfer to find the fastest.',
    body: `A cable is never where you need it, and uploading a video to the cloud just to download it again is a waste of time and mobile data. Here is how to move files between a phone and a computer wirelessly.

## The four wireless methods

### 1. Cloud storage

Upload from the phone, download on the computer. It works anywhere with internet, and it keeps a backup. The downsides are the double transfer (up, then down), the storage limits on free plans, and the fact that your file now lives on someone else's server.

### 2. Email or messaging apps

Fine for a couple of small documents. Large photos and videos are often compressed or rejected, and attachments have size limits.

### 3. Bluetooth

Bluetooth needs no network, but it is slow. A few megabytes is fine, a video can take minutes.

### 4. Peer-to-peer in the browser

Modern browsers can connect two devices directly and send a file straight from one to the other, using a technology called WebRTC. The file does not pass through a server at all, so it is as fast as your Wi-Fi allows and stays private.

## How browser-based transfer works in practice

1. Open the same web page on both devices (for example, on the same Wi-Fi).
2. Drop or choose a file on the sender.
3. The receiving device shows the file. Tap download.

With Jodbox, files are split into blocks and each block is verified, so a big file that gets interrupted can pause and resume instead of starting over.

## Which method should you use?

- **One or two small documents:** email or chat.
- **A folder of photos you want to keep:** cloud storage.
- **Large videos or many photos, right now:** peer-to-peer over Wi-Fi.
- **No Wi-Fi at all:** Bluetooth, and be patient.

## Tips for faster transfers

- Use the 5 GHz Wi-Fi band when you have a choice. It is much faster than 2.4 GHz at close range.
- Keep both devices awake and the browser tab open during the transfer.
- Send many small files as one zip, which is quicker than many separate transfers.
- If the devices are on different networks, link them first with a code or QR so they can find each other.

## A note on privacy

When a file goes through a cloud service, a copy exists on their servers. Peer-to-peer transfer never stores your file anywhere except on the devices involved. For private documents, that difference matters.`,
  },
  {
    slug: 'is-public-wifi-safe-for-sharing-files', title: 'Is Public Wi-Fi Safe for Sharing Files? A Practical Privacy Guide', category: 'privacy-security',
    tags: ['public wifi', 'privacy', 'security'],
    excerpt: 'Cafe, airport and hotel Wi-Fi are convenient and risky. Learn what can actually go wrong and how to share files and messages safely on a network you do not control.',
    seoTitle: 'Is Public Wi-Fi Safe? How to Share Files Securely on Open Networks',
    seoDescription: 'The real risks of public Wi-Fi and the simple habits that keep your files and messages private: HTTPS, peer-to-peer transfer and encrypted chat rooms.',
    body: `Public Wi-Fi is everywhere, and so is the advice to avoid it. The truth is more nuanced: it is much safer than it used to be, and it is still not a place for careless sharing.

## What can actually go wrong

**Snooping on unencrypted traffic.** Almost every site uses HTTPS now, which encrypts what you send. Anything that is not encrypted can be read by someone on the same network.

**Fake hotspots.** An attacker can create a network named like the cafe's, and you join it by mistake. Everything you send passes through their device.

**Other people on the same network.** On open networks, devices can see each other. If you use a tool that treats "same network" as "trusted", strangers can end up in the same space as you.

## Habits that keep you safe

1. **Check the network name** with staff before you join.
2. **Look for HTTPS** (the padlock) on every site and never ignore certificate warnings.
3. **Turn off automatic sharing** such as file sharing and AirDrop-style discovery on public networks.
4. **Use a VPN** if you handle anything sensitive. It encrypts everything between your device and the VPN server.
5. **Keep software updated.** Most attacks use known, patched holes.

## Sharing files on a shared network

If you use a same-network sharing tool, remember that the "space" is defined by the network. On public Wi-Fi, unrelated people can share it. That is fine for a link or a public file and a bad idea for a password or a private document.

Better options for sensitive items:

- **Peer-to-peer transfer** keeps the file off servers, but anyone in the same space can see that a file exists.
- **End-to-end encrypted rooms** protect the content with a password that only the people in the room know.
- **Linking devices** with a one-time code puts only your own devices in the same space, even across networks.

## A simple rule of thumb

> If you would not shout it across the cafe, do not put it on a shared scratchpad.

For everything else, an encrypted private room takes ten seconds to create and disappears when everyone leaves.

## Summary

Public Wi-Fi is fine for browsing over HTTPS. For sharing, choose tools that encrypt your content or keep it between your own devices, and keep secrets out of anything that is shared by network.`,
  },
  {
    slug: 'end-to-end-encrypted-chat-rooms-explained', title: 'End-to-End Encrypted Chat Rooms: How They Keep Your Messages Private', category: 'privacy-security',
    tags: ['encryption', 'secure chat', 'privacy'],
    excerpt: 'What "end-to-end encrypted" really means, how a password-protected room works without accounts, and what a throwaway chat can and cannot protect you from.',
    seoTitle: 'End-to-End Encrypted Chat Rooms Explained (No Account Needed)',
    seoDescription: 'Understand how end-to-end encryption protects a chat room, how password-based rooms work without accounts, and when a disappearing chat is the right choice.',
    body: `"End-to-end encrypted" is printed on a lot of apps. Here is what it means, what it does not mean, and how a simple password-protected room can deliver it.

## What end-to-end encryption means

Messages are encrypted on your device before they leave it, and only decrypted on the device of the person you are talking to. The server that carries the message in between only ever sees scrambled data. Even the people who run the server cannot read it.

## How a password-based room works

A chat room can be protected without any accounts:

1. You choose a room password. It is turned into an encryption key **on your device** using a deliberately slow function (PBKDF2), which makes guessing passwords expensive.
2. Each message is encrypted with that key and sent as ciphertext.
3. The other people in the room enter the same password, derive the same key and decrypt the messages.

The password never leaves your device. The server stores only a verifier that proves someone knows the password, never the password or the key itself.

## What gets stored, and for how long

In a privacy-focused room:

- Messages are kept only briefly in memory so a short connection drop does not lose them.
- New joiners do not see anything from before they arrived.
- When the last person leaves, the room's messages are wiped.

## What encryption does not protect

It is worth being honest about the limits.

- **A weak password.** Anyone who guesses it can read the room. Use a long passphrase.
- **A compromised device.** If someone controls your phone, they see what you see.
- **Screenshots and copying.** Any participant can save what they read.
- **Metadata.** The fact that a room exists, and roughly when it is active, is visible to the server.

## Sharing the password safely

The link and the password should travel on different channels where possible. Send the link in one app and the password in another, or tell it in person. If you send both in one message, anyone who sees that message can enter the room, so only do that when the risk is low.

## When to use a throwaway room

- Sending a one-time code or a private link to a colleague.
- Discussing something sensitive with up to a few people.
- Talking on a network you do not trust.

For long-running conversations with history, use a regular messenger. For quick private exchanges that should leave no trace, a disappearing encrypted room is hard to beat.`,
  },
  {
    slug: 'how-peer-to-peer-file-sharing-works-webrtc', title: 'Peer-to-Peer File Sharing Explained: How WebRTC Moves Files Without a Server', category: 'technology',
    tags: ['webrtc', 'peer to peer', 'technology'],
    excerpt: 'Your browser can send a file straight to another browser. This is how WebRTC connects two devices, why it is fast and private, and where its limits are.',
    seoTitle: 'How Peer-to-Peer File Sharing Works: WebRTC Explained Simply',
    seoDescription: 'A plain-English guide to WebRTC file transfer: how two browsers connect directly, what STUN and TURN do, and why peer-to-peer is fast and private.',
    body: `Most things on the web go through a server. You upload a file, the server stores it, someone else downloads it. Peer-to-peer (P2P) skips the middle: one browser sends the file straight to the other.

## The technology: WebRTC

WebRTC is a set of features built into modern browsers for real-time communication. It powers video calls, and it can also send arbitrary data, including files, over a **data channel**.

## How two browsers find each other

Two devices that want to talk directly need to solve three problems.

### 1. Signalling

Before they can connect, the devices must exchange small messages: who they are, what they support and how to reach them. A lightweight server relays these messages. It never sees the file.

### 2. Finding a route (STUN)

Most devices sit behind a router and have a private address. A STUN server tells each device what its public address looks like, so the two can try to connect directly.

### 3. The fallback (TURN)

Some networks, such as strict corporate firewalls and certain mobile carriers, block direct connections. A TURN server then relays the encrypted data. Transfers still work, though they now pass through a relay and may be slower.

## Why P2P is fast

On the same Wi-Fi, data travels from one device to the other without leaving your building. Speeds are limited by your router, not by an internet upload or a server's bandwidth.

## Why P2P is private

The file is never stored on a server. WebRTC connections are encrypted, so even a relay cannot read the content.

## How big files are handled

Large files are split into blocks. Each block is hashed so the receiver can verify it arrived intact. If the connection drops, the transfer continues from the last verified block instead of starting over.

## Limits to know about

- **Both devices must be online at the same time.** Nothing is waiting on a server for later.
- **Browser memory.** Browsers that cannot write directly to disk limit how large a file can be.
- **Strict networks** may need a relay.

## When P2P is the right choice

- Large files between your own devices.
- Anything private that should not sit in a cloud account.
- Quick transfers when both devices are in the same room.

For sharing with many people over time, or when the receiver is offline, cloud storage is still the better tool.`,
  },
  {
    slug: '10-ways-to-move-links-notes-files-between-devices', title: '10 Ways to Move Links, Notes and Files Between Your Devices', category: 'tips-tricks',
    tags: ['productivity', 'tips', 'workflow'],
    excerpt: 'Email, chat, cloud notes, QR codes and shared scratchpads: ten practical ways to get something from one device to another, and when to use each.',
    seoTitle: '10 Ways to Move Links, Notes and Files Between Devices',
    seoDescription: 'Ten practical methods to send links, notes and files between your phone, tablet and computer, with the pros and cons of each so you can pick the fastest.',
    body: `Everyone has a favourite way of getting something from one device to another. Here are ten, with honest pros and cons.

## 1. A shared live scratchpad

Open the same page on both devices and type or paste. It is instant, needs no account and works across brands. Best for links, snippets and quick notes.

## 2. Message yourself

A chat with yourself in a messaging app is a classic. It works everywhere you are signed in, and it becomes a messy pile over time.

## 3. Email yourself

Reliable and searchable. Slow for throwaway items.

## 4. Cloud notes

A notes app that syncs keeps things organised. It needs the same app and account on every device.

## 5. Browser sync

If you use the same browser everywhere, "send tab to device" is quick for web pages only.

## 6. QR codes

Show a link as a QR code on your screen and scan it with your phone. Great for getting a long address onto a phone, not for text.

## 7. Cloud drives

Best for files you want to keep and share with others, slower for one-off transfers.

## 8. Peer-to-peer browser transfer

Send files straight between two browsers over Wi-Fi. Fast and private, ideal for big photos and videos.

## 9. Bluetooth

No network needed, but slow and often fiddly to pair.

## 10. USB cable

Still the fastest for a whole phone backup, and the one you never have with you.

## How to choose

Ask three questions:

1. **How big is it?** Text and links: scratchpad. Large files: peer-to-peer or cloud.
2. **Do I want to keep it?** If yes, cloud or email. If not, anything instant.
3. **Is it private?** If yes, avoid shared spaces and use an encrypted room or peer-to-peer.

## A simple workflow that works

Keep a shared scratchpad open on your computer. Paste links and snippets from your phone as you find them. At the end of the day, copy what you want to keep into your notes and clear the scratchpad.`,
  },
  {
    slug: 'install-web-app-on-home-screen-android-iphone', title: 'How to Install a Web App on Your Home Screen (Android, iPhone and Desktop)', category: 'guides',
    tags: ['pwa', 'install', 'mobile'],
    excerpt: 'A progressive web app installs from your browser in seconds, opens full screen and works like a native app. Here is how to add one to your phone or computer.',
    seoTitle: 'How to Install a Web App (PWA) on Android, iPhone and Desktop',
    seoDescription: 'Step-by-step instructions to add a progressive web app to your home screen on Android, iPhone and desktop, and what you gain: speed and full screen.',
    body: `A progressive web app (PWA) is a website that can be installed like an app. You get an icon on your home screen, a full-screen window and fast launches, without an app store.

## Why install instead of using a browser tab

- **One tap to open,** just like any other app.
- **Full screen,** with no address bar taking space.
- **Faster start,** because the app shell is stored on your device.
- **Works offline** for the basics.
- **Appears in the share menu** of other apps, so you can send things to it directly.

## Android (Chrome)

1. Open the site in Chrome.
2. Tap the **three-dot menu**.
3. Choose **Install app** (or **Add to Home screen**).
4. Confirm. The icon appears on your home screen.

## iPhone and iPad (Safari)

1. Open the site in Safari.
2. Tap the **Share** button.
3. Scroll and tap **Add to Home Screen**.
4. Name it and tap **Add**.

## Windows, macOS and Linux (Chrome or Edge)

1. Open the site.
2. Click the **install icon** at the right end of the address bar, or open the browser menu and choose **Install**.
3. The app opens in its own window and appears in your app launcher.

## Troubleshooting

- **No install option?** Make sure you are on the real site address over HTTPS and not inside another app's built-in browser.
- **iPhone only shows Share to Add?** Other browsers on iOS cannot install apps. Use Safari.
- **App looks outdated?** Close it fully and reopen. It updates itself in the background.

## Is it safe?

An installed web app has the same permissions as the website in your browser. It cannot access files or contacts unless you grant permission, and you can remove it like any other app.

## Summary

Installing takes less than ten seconds and makes a tool you use often feel native. If you share text and files between devices daily, having it one tap away saves real time.`,
  },
  {
    slug: 'link-devices-on-different-networks-with-qr-code', title: 'How to Link Devices on Different Networks With a QR Code', category: 'guides',
    tags: ['qr code', 'link devices', 'mobile data'],
    excerpt: 'Your laptop is on Wi-Fi and your phone is on mobile data, so they cannot see each other. A short code or a QR scan puts them in the same space in seconds.',
    seoTitle: 'Link a Phone on Mobile Data to Your Computer With a QR Code',
    seoDescription: 'Connect devices on different networks without accounts: scan a QR code or type a short code to join the same shared space, and unlink any time.',
    body: `Same-network sharing is magic until your phone is on mobile data and your laptop is on Wi-Fi. They are on different networks, so they do not find each other. Linking solves that.

## What linking does

A shared space is normally defined by your network. Linking lets you add another device to your space regardless of where it is. The phone then sees the same text and files as the laptop, even from another city.

## Three ways to link

### Scan a QR code

1. On the first device, open the link option and choose to show a QR code.
2. On the phone, scan it with the camera.
3. The phone joins your space immediately.

### Type a short code

If scanning is not convenient, the first device shows an 8-character code. Enter it on the second device. Codes work once and expire quickly, so a leaked code is not a long-term risk.

### Share a link

Send the link through any messenger. Opening it links the device.

## Linked devices and networks

You can see everything that is linked in settings. Remove a device at any time and it goes back to its own space.

## Security tips

- Treat a code like a key. Only share it with someone you trust and only when you need it.
- Codes are single use and short lived, so generate a fresh one each time.
- Review your linked devices now and then, and unlink any you no longer use.

## When linking is useful

- Your phone is on mobile data and your laptop is on Wi-Fi.
- You work from two locations and want the same scratchpad in both.
- You want to send a file to a friend who is on another network.

## Summary

Linking takes a few seconds and removes the biggest limit of same-network sharing. Scan, type or open a link, and your devices are in the same space wherever they are.`,
  },
]
