/**
 * Starter FAQ for the platform, loaded once by `pnpm db:seed-faq` into an empty `faqs` table. Written for visitors: no
 * product name (so it reads right whatever the site is called), nothing about running the site, and every question is
 * framed as something a visitor wants to do or know. Answers are Markdown.
 */
export interface SeedFaq { category: string; question: string; answer: string }

export const SEED_FAQS: SeedFaq[] = [
  // ---- Getting started ----
  {
    category: 'Getting started',
    question: 'What is this and what can I do with it?',
    answer: `It is the quickest way to move things between your own devices. Open it on your phone and your laptop, type or paste on one, and it shows up on the other straight away. You can also:

- send **files** from one device to another, directly
- **link** a device on a different network, such as a phone on mobile data
- start a **private chat room** that is encrypted and disappears when everyone leaves

There is nothing to install and nothing to sign up for.`,
  },
  {
    category: 'Getting started',
    question: 'Do I need an account or to install anything?',
    answer: `No. Open the website on each device and you are ready. If you like, you can add it to your home screen so it opens like an app (see "How do I install it on my phone or computer?").`,
  },
  {
    category: 'Getting started',
    question: 'Is it free?',
    answer: `Yes, it is free to use. There are no accounts, subscriptions or storage fees.`,
  },
  {
    category: 'Getting started',
    question: 'How does it know which devices are mine?',
    answer: `Devices that open the site from the **same network** (the same Wi-Fi or router) are put into the same shared space automatically. You will see how many devices are online at the top of the page.

Devices on other networks join your space when you **link** them. See "How do I connect a phone on mobile data to my laptop?". For a conversation that only certain people can enter, start a **secure chat room**.`,
  },
  {
    category: 'Getting started',
    question: 'Which browsers and devices work?',
    answer: `Any modern browser on a phone, tablet, laptop or desktop, for example Chrome, Edge, Firefox, Safari and Brave. Scanning a QR code uses your camera, which your browser will ask permission for.`,
  },

  // ---- Sharing text ----
  {
    category: 'Sharing text',
    question: 'How do I share text between my devices?',
    answer: `Open the site on both devices, then type or paste into the **Scratchpad**. It appears on your other devices within a moment, and works both ways. A tick shows when your text is saved.

Handy buttons: **Paste** drops in whatever you copied, **Copy** copies the whole pad, **Save .txt** downloads it as a text file, and **Clear** empties it on every device.

If two people type at the very same moment, the most recent change wins.`,
  },
  {
    category: 'Sharing text',
    question: 'How much text can I share?',
    answer: `The scratchpad holds up to about 100,000 characters by default, which is a very long document. A counter appears as you get close.`,
  },
  {
    category: 'Sharing text',
    question: 'How long is my text kept?',
    answer: `Your text is saved so it is still there when you come back, and it is encrypted while stored. Press **Clear** to remove it from every device at any time. A space that nobody has used for **90 days** is cleaned up automatically, along with its text.`,
  },
  {
    category: 'Sharing text',
    question: 'How do I keep things private on a shared Wi-Fi?',
    answer: `Your scratchpad is shared with the devices on your network, which is what makes it instant. At home that is just you. On a public or shared network, such as a cafe, hotel or office, keep sensitive things for a **secure chat room**: it is protected by a password that only you and the people you invite know, and everything in it is encrypted.`,
  },
  {
    category: 'Sharing text',
    question: 'What does the Links tab do?',
    answer: `Every web address in your text is collected in the **Links** list. A link you typed on your laptop can be opened on your phone with one tap, or copied. It recognises full addresses, \`www\` addresses and plain domain names.

You can switch the list off, or choose whether links open in a new tab, in **Settings**.`,
  },
  {
    category: 'Sharing text',
    question: 'Can I use it offline?',
    answer: `The app opens even without a connection. Anything you type is sent to your other devices as soon as you are back online, so you can keep working on a train or in a lift.`,
  },

  // ---- Sharing files ----
  {
    category: 'Sharing files',
    question: 'How do I send a file to another device?',
    answer: `Open the **Files** section and drop your files onto it, or tap it to choose them. They then appear on your other devices. Small files (under 50 MB) download by themselves; for the rest, tap the file to download it. **Get all** fetches everything you are missing, and **Zip** saves the finished files as a single zip.

Keep the page open on the sending device until the other device has finished.`,
  },
  {
    category: 'Sharing files',
    question: 'Are my files stored on your servers?',
    answer: `**No.** Files go straight from one device to the other (peer to peer). Our servers only help the devices find each other, so nothing of yours is kept. That is also why the sending device stays online with the page open until the download is complete.`,
  },
  {
    category: 'Sharing files',
    question: 'How big can my files be?',
    answer: `Send up to **100 files** at a time, each up to **4 GB**. Because nothing is uploaded to a server, there is no storage quota; very large files simply depend on your devices' free space and the speed of your network. A few browsers keep files in memory instead of on disk, and the page tells you when that is the case (files up to about 500 MB).`,
  },
  {
    category: 'Sharing files',
    question: 'How can I get the fastest file transfers?',
    answer: `- Put both devices on the **same Wi-Fi**. Files then travel directly across your own network, at full speed.
- Keep the page **open on the sending device** until the other device is done.
- Large files can **pause and resume**: if a download is interrupted or the page is reloaded, it carries on from where it stopped once the sender is back. Every piece is checked as it arrives, so your file always arrives complete.
- Some workplace, school or mobile networks do not allow direct connections between devices. If you see a "direct connection blocked" notice, switch to the same Wi-Fi or another network.`,
  },

  // ---- Linking devices ----
  {
    category: 'Linking devices',
    question: 'How do I connect a phone on mobile data to my laptop?',
    answer: `**Link** the devices, so they share one space even on different networks.

1. On one device open **Settings**, then **Link Device**.
2. Choose how to connect: show a **QR code** to scan, share a **code or link**, or link by **IP address**.
3. On the other device scan the QR code, or open the link or enter the code.

The two devices now share the same scratchpad and files.`,
  },
  {
    category: 'Linking devices',
    question: 'How long does a link code last?',
    answer: `A code or QR code works for about **5 minutes** and can be used **once**, which keeps linking safe. Press **Refresh Code** whenever you need a new one.`,
  },
  {
    category: 'Linking devices',
    question: 'How do I unlink a device?',
    answer: `Open **Settings**, then **Linked Devices**, and choose **Unlink** next to the device or network. It returns to its own separate space straight away.`,
  },
  {
    category: 'Linking devices',
    question: 'Can I connect devices on different networks or a VPN?',
    answer: `Yes. Devices on the same Wi-Fi find each other automatically. If your devices are on different networks, such as a main and a guest Wi-Fi, mobile data, or a VPN, just **link** them (see above) and they behave like one space from then on.`,
  },

  // ---- Secure chat ----
  {
    category: 'Secure chat',
    question: 'How do I start a private chat?',
    answer: `Open **Secure Chat**, choose a password of at least 8 characters, and press **Create secure room**. Then tap **Invite** to send the room link to the people you want. They open the link and enter the password to join. A room holds up to **4 people**.`,
  },
  {
    category: 'Secure chat',
    question: 'How do I invite someone, and what message do they get?',
    answer: `Tap **Invite** inside the room. You can send a ready-made message through **WhatsApp**, **SMS** (on phones), **email**, your phone's share menu, or copy it. There is also a QR code for someone next to you.

The message says you have sent a secret message and gives the room link. It can also include the password, if you tick **Include the password in the message**. For the best protection, leave that off and tell the person the password separately, for example by a call or in a different app, so the link alone opens nothing.`,
  },
  {
    category: 'Secure chat',
    question: 'Is secure chat really private?',
    answer: `Yes. Messages are **encrypted in your browser** with a key made from the room password, and your password is never sent to us. Our server only passes along scrambled data it cannot read.

- People who join later **cannot see earlier messages**.
- Messages are kept only briefly in the server's memory, never in a database, and are deleted when the room empties.
- Even we cannot read your chat.

Share the link and password only with people you trust.`,
  },
  {
    category: 'Secure chat',
    question: 'How are chat room passwords handled?',
    answer: `Only you and the people you tell know the password. It is turned into an encryption key on your own device and is **never sent to us or stored**, so nobody else can see it or reset it. That is what keeps the room private. If you ever want a different password, create a new room and invite everyone to it in a few taps.`,
  },
  {
    category: 'Secure chat',
    question: 'How many people can join a chat room?',
    answer: `A room holds up to **4 people**, which keeps it small and private. If it is full, once someone leaves you can press **Try again** to join.`,
  },
  {
    category: 'Secure chat',
    question: 'Can I rejoin a chat if I get disconnected?',
    answer: `Yes. The app reconnects by itself and you carry on where you were, as long as you are back within a short time. If you are away for longer, open the room link and enter the password to join again. Like any new joiner, you will see messages from that point on.`,
  },
  {
    category: 'Secure chat',
    question: 'How do I leave or delete a room?',
    answer: `**Leave & wipe** takes you out and clears the chat from your screen. The person who created the room can also use the **bin icon** to delete it for everyone. A room that nobody is in is wiped automatically.`,
  },

  // ---- Privacy & security ----
  {
    category: 'Privacy & security',
    question: 'What information do you collect?',
    answer: `As little as possible.

- **No accounts**, names or email addresses are needed.
- Your network is recognised by a **one-way scrambled version** of its public IP address. The address itself is never stored.
- One small **cookie** remembers your device so linking and your settings work.
- Your text is **encrypted** while stored, files are **never stored**, and chat messages are kept only briefly and encrypted.

See the Privacy page for the full details.`,
  },
  {
    category: 'Privacy & security',
    question: 'Can I clear my data whenever I want?',
    answer: `Yes, you are always in control.

- Press **Clear** to empty the scratchpad on every device.
- Remove a file from the **Files** list (or use the bin icon to remove them all). It disappears from every device.
- **Leave** a chat room, or delete a room you created.
- **Unlink** devices you no longer use.

Anything left unused for 90 days is cleaned up automatically.`,
  },

  // ---- Help ----
  {
    category: 'Help',
    question: 'How do I make sure my devices stay in sync?',
    answer: `1. Open the **same website address** on every device, and keep them **online**.
2. Put them on the **same network**, or **link** them.
3. Press the **reload** button next to the scratchpad any time to fetch the latest copy.

That is all it takes. If something does not look right, let us know on the Feedback page.`,
  },
  {
    category: 'Help',
    question: 'How do I install it on my phone or computer?',
    answer: `- **Android (Chrome):** open the menu and choose **Install app** or **Add to Home screen**.
- **iPhone or iPad (Safari):** tap **Share**, then **Add to Home Screen**.
- **Computer (Chrome or Edge):** click the **install icon** in the address bar.

It then opens in its own window like any other app, and shows up in your phone's share menu so you can send things to it from other apps.`,
  },
  {
    category: 'Help',
    question: 'How do I share feedback or ask for a feature?',
    answer: `Use the **Feedback** page. Give a star rating, write a few words, and send it. We read every message and love hearing what would make this better for you.`,
  },
]
