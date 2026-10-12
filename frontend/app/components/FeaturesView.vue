<script setup lang="ts">
/** The Features page body, shared by the app (internal links) and the SEO site (absolute links to the app). */
const props = defineProps<{ appHref: string; internal?: boolean }>()
const emit = defineEmits<{ feedback: [] }>()
const name = String(useRuntimeConfig().public.appName)
const Go = props.internal ? resolveComponent('NuxtLink') : 'a'
const goAttrs = props.internal ? { to: props.appHref } : { href: props.appHref }

const stats = [
  { n: '0', l: 'accounts to create' }, { n: '0 B', l: 'of your files kept on our servers' }, { n: '4', l: 'people in a secure chat room' }, { n: '100%', l: 'in your browser, no install' },
]
const sections = [
  { id: 'sync', icon: 'refresh', tone: 'blue', title: 'Live text sync', lead: 'Type or paste on one device and it appears on every other device on your network, instantly.',
    points: ['Edits sync both ways, in real time', 'Work you do offline is sent the moment you reconnect', 'Copy, paste and save as a text file in one tap'] },
  { id: 'files', icon: 'upload', tone: 'pink', title: 'Device-to-device files', lead: 'Drop in a file and it travels straight from one device to the other. It never touches our servers.',
    points: ['Peer-to-peer over WebRTC, every block verified', 'Big files pause and resume, even after a reload', 'Download everything at once or as a single zip'] },
  { id: 'link', icon: 'qr', tone: 'blue', title: 'Link any device, anywhere', lead: 'A phone on mobile data? Scan a QR code or type a short code and it joins your space in seconds.',
    points: ['QR code, 8-character code or a link', 'Unlink any device at any time', 'Works across different networks and countries'] },
  { id: 'chat', icon: 'lock', tone: 'pink', title: 'Secure private chat', lead: 'Password-protected rooms for up to four people. Messages are encrypted in your browser.',
    points: ['End-to-end encrypted, the server only sees ciphertext', 'No history for newcomers and the room wipes when it empties', 'Invite with WhatsApp, SMS, email or a QR code'] },
  { id: 'links', icon: 'link', tone: 'blue', title: 'Found links, ready to open', lead: 'Every web address in your shared text is collected in a tidy list, so a link typed on your laptop opens on your phone.',
    points: ['Tap to open, or copy a link with one tap', 'Understands www addresses and plain domains', 'Open in a new tab or the current one, your choice'] },
  { id: 'app', icon: 'phone', tone: 'pink', title: 'Installs like an app', lead: 'Add it to your home screen on Android, iPhone or desktop. It opens instantly and feels native.',
    points: ['Works offline for the basics', 'Shows up in the share menu of other apps', 'Light and dark themes that follow your device'] },
]
const more = [
  { icon: 'shield', t: 'Private by design', d: 'Networks are matched by a keyed hash of the IP address, never the address itself.' },
  { icon: 'bolt', t: 'Fast', d: 'Text syncs in a blink and files move at the speed of your own network.' },
  { icon: 'noCloud', t: 'No file storage', d: 'Files are shared device to device, so there is nothing of yours to leak.' },
  { icon: 'devices', t: 'Every device', d: 'Phones, tablets, laptops and desktops, on any modern browser.' },
]
const tone = (t: string): string => (t === 'pink' ? 'bg-pink-soft text-pink-ink' : 'bg-accent-soft text-accent-ink')
const solid = (t: string): string => (t === 'pink' ? 'bg-pink' : 'bg-[var(--blue)]')
</script>

<template>
  <div class="pb-6">
    <!-- hero -->
    <header class="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
      <div>
        <span class="chip">Features</span>
        <h1 class="text-[2rem] md:text-5xl font-semibold mt-4 leading-[1.1]">One shared space for <span class="text-[var(--blue)]">all</span> <span class="text-pink">your</span> devices</h1>
        <p class="text-muted mt-4 text-base md:text-lg max-w-xl leading-relaxed">{{ name }} moves text and files between your phone, tablet and computer in seconds. Free, private, and nothing to install or sign up for.</p>
        <div class="flex flex-wrap gap-2.5 mt-6">
          <component :is="Go" v-bind="goAttrs" class="btn btn-accent !min-h-11 px-5">Open {{ name }}<Icon name="arrowRight" :size="16" weight="bold" /></component>
          <a href="#how" class="btn !min-h-11 px-5">How it works</a>
        </div>
      </div>
      <!-- two devices in sync -->
      <div class="relative mx-auto w-full max-w-md pb-10 pr-6" aria-hidden="true">
        <div class="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
          <div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-surface-2"><span class="size-2.5 rounded-full bg-pink" /><span class="size-2.5 rounded-full bg-warn" /><span class="size-2.5 rounded-full bg-ok" />
            <span class="ml-3 text-[11px] text-muted font-medium">Scratchpad</span></div>
          <div class="p-4 space-y-2.5"><div class="h-2.5 w-4/5 rounded-full bg-line" /><div class="h-2.5 w-3/5 rounded-full bg-line" /><div class="h-2.5 w-11/12 rounded-full bg-line" />
            <div class="flex items-center gap-2 pt-2"><span class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft text-accent-ink text-[11px] font-semibold px-2.5 py-1"><Icon name="link" :size="12" />example.com/docs</span></div></div>
        </div>
        <div class="absolute right-0 -bottom-0 w-36 rounded-[26px] border-[5px] border-ink bg-surface shadow-card overflow-hidden">
          <div class="mx-auto mt-1.5 h-1 w-10 rounded-full bg-line" />
          <div class="p-3 space-y-2"><div class="h-2 w-4/5 rounded-full bg-line" /><div class="h-2 w-3/5 rounded-full bg-line" /><div class="h-2 w-11/12 rounded-full bg-line" />
            <div class="rounded-lg bg-pink-soft text-pink-ink text-[10px] font-semibold px-2 py-1.5 flex items-center gap-1"><Icon name="check" :size="11" weight="bold" />Synced just now</div></div>
        </div>
        <span class="absolute left-1/2 top-[58%] -translate-x-1/2 size-9 rounded-full bg-[var(--blue)] text-white grid place-items-center shadow-card ring-4 ring-bg"><Icon name="swap" :size="17" weight="bold" /></span>
      </div>
    </header>

    <!-- numbers -->
    <ul class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12" aria-label="At a glance">
      <li v-for="(s, n) in stats" :key="s.l" class="card !shadow-none px-4 py-4 text-center">
        <p class="text-2xl md:text-3xl font-semibold tabular-nums" :class="n % 2 ? 'text-pink' : 'text-[var(--blue)]'">{{ s.n }}</p>
        <p class="text-xs md:text-sm text-muted mt-1 leading-snug">{{ s.l }}</p>
      </li>
    </ul>

    <!-- feature rows -->
    <div class="mt-16 space-y-14 md:space-y-20">
      <section v-for="(f, n) in sections" :id="f.id" :key="f.id" class="grid md:grid-cols-2 gap-6 md:gap-12 items-center">
        <div :class="n % 2 ? 'md:order-2' : ''">
          <span class="size-11 rounded-xl grid place-items-center" :class="tone(f.tone)"><Icon :name="f.icon" :size="22" weight="bold" /></span>
          <h2 class="text-2xl md:text-3xl font-semibold mt-4">{{ f.title }}</h2>
          <p class="text-muted mt-3 leading-relaxed text-[0.9375rem] md:text-base">{{ f.lead }}</p>
          <ul class="mt-4 space-y-2.5">
            <li v-for="p in f.points" :key="p" class="flex items-start gap-3 text-sm md:text-[0.9375rem]">
              <span class="mt-0.5 size-5 rounded-full grid place-items-center text-white shrink-0" :class="solid(f.tone)"><Icon name="check" :size="12" weight="bold" /></span><span>{{ p }}</span>
            </li>
          </ul>
        </div>

        <!-- a small picture of the feature -->
        <div class="card !shadow-none p-5 md:p-6 bg-surface-2/60" :class="n % 2 ? 'md:order-1' : ''" aria-hidden="true">
          <template v-if="f.id === 'sync'">
            <div class="space-y-3">
              <div v-for="d in ['Laptop', 'Phone']" :key="d" class="card !shadow-none p-3.5"><div class="flex items-center gap-2 text-xs font-semibold text-muted"><Icon :name="d === 'Laptop' ? 'desktop' : 'phone'" :size="15" />{{ d }}<span class="ml-auto inline-flex items-center gap-1 text-ok"><span class="size-1.5 rounded-full bg-ok" />Live</span></div>
                <p class="mt-2 text-sm">Pick up milk, call Sam about the deck</p><span class="inline-block w-px h-4 bg-[var(--accent)] align-middle animate-pulse" /></div>
            </div>
          </template>
          <template v-else-if="f.id === 'files'">
            <div class="card !shadow-none p-4 flex items-center gap-3"><span class="size-11 rounded-xl bg-pink-soft text-pink-ink grid place-items-center text-[11px] font-bold">PDF</span>
              <div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">holiday-photos.zip</p><p class="text-xs text-muted">48 MB · 72% · from Pixel 8</p>
                <div class="mt-2 h-1.5 rounded-full bg-line overflow-hidden"><div class="h-full w-[72%] bg-[var(--accent)] rounded-full" /></div></div></div>
            <div class="flex flex-wrap gap-2 mt-3"><span class="chip">Peer to peer</span><span class="chip chip-pink">Verified</span><span class="chip">Resumable</span></div>
          </template>
          <template v-else-if="f.id === 'link'">
            <div class="flex items-center gap-5">
              <div class="grid grid-cols-7 gap-[3px] p-2.5 bg-white rounded-lg border border-line shrink-0"><span v-for="i in 49" :key="i" class="size-3 rounded-[2px]" :class="[3, 5, 8, 9, 10, 12, 15, 17, 19, 22, 24, 26, 27, 29, 31, 33, 36, 38, 40, 41, 43, 45, 47, 1, 7, 13, 35, 42, 49].includes(i) ? 'bg-ink' : 'bg-transparent'" /></div>
              <div><p class="text-xs text-muted">Or type the code</p><p class="font-mono text-xl font-semibold tracking-[0.18em] mt-1">K7QM-4XZP</p><span class="chip mt-3">Linked in seconds</span></div>
            </div>
          </template>
          <template v-else-if="f.id === 'chat'">
            <div class="space-y-2">
              <div class="flex"><span class="rounded-2xl rounded-bl-sm bg-pink text-white text-sm px-3.5 py-2">Are we still on for 6?</span></div>
              <div class="flex justify-end"><span class="rounded-2xl rounded-br-sm bg-[var(--blue)] text-white text-sm px-3.5 py-2">Yes. Room link is in WhatsApp.</span></div>
              <div class="flex"><span class="rounded-2xl rounded-bl-sm bg-[#0E9F8E] text-white text-sm px-3.5 py-2">Joined</span></div>
              <p class="text-[11px] text-muted text-center pt-1 flex items-center justify-center gap-1"><Icon name="lock" :size="12" />End-to-end encrypted</p>
            </div>
          </template>
          <template v-else-if="f.id === 'links'">
            <div class="space-y-2"><div v-for="u in [['github.com', '/anthropics'], ['docs.google.com', '/document/d/1x'], ['example.com', '']]" :key="u[0]" class="card !shadow-none flex items-center gap-3 px-3 py-2.5">
              <span class="size-8 rounded-lg bg-accent-soft text-accent-ink grid place-items-center"><Icon name="link" :size="16" /></span><span class="flex-1 min-w-0"><span class="block text-sm font-medium leading-tight">{{ u[0] }}</span><span v-if="u[1]" class="block text-xs text-muted">{{ u[1] }}</span></span><Icon name="copy" :size="16" class="text-muted" /></div></div>
          </template>
          <template v-else>
            <div class="flex items-center justify-center gap-6">
              <div class="w-24 rounded-[22px] border-[5px] border-ink bg-surface p-2 text-center"><img src="/logo-mark.webp" alt="" class="mx-auto h-9 w-auto mt-3"><p class="text-[10px] font-semibold mt-2">{{ name }}</p><div class="h-1 w-8 rounded-full bg-line mx-auto mt-3" /></div>
              <div class="space-y-2 text-sm"><p class="flex items-center gap-2"><Icon name="check" :size="15" weight="bold" class="text-ok" />Add to home screen</p><p class="flex items-center gap-2"><Icon name="check" :size="15" weight="bold" class="text-ok" />Opens full screen</p><p class="flex items-center gap-2"><Icon name="check" :size="15" weight="bold" class="text-ok" />Works offline</p></div>
            </div>
          </template>
        </div>
      </section>
    </div>

    <!-- how it works -->
    <section id="how" class="mt-20" aria-labelledby="how-h">
      <div class="text-center"><span class="chip">How it works</span><h2 id="how-h" class="text-2xl md:text-3xl font-semibold mt-3">Up and running in a minute</h2></div>
      <ol class="mt-8 grid md:grid-cols-3 gap-4 md:gap-6">
        <li v-for="(s, i) in [['devices', 'Open it', 'On any device on the same Wi-Fi or network. No account, nothing to install.'], ['files', 'Type or drop', 'Text shows up everywhere right away. Files go directly between your devices.'], ['qr', 'Link or chat', 'Bring other networks in with a code, or start an encrypted room that vanishes.']]" :key="s[1]" class="card p-5 relative">
          <div class="flex items-center gap-3"><span class="size-11 rounded-xl grid place-items-center text-white" :class="i === 1 ? 'bg-pink' : 'bg-[var(--blue)]'"><Icon :name="s[0]!" :size="22" weight="bold" /></span><span class="text-xs font-semibold tracking-wide uppercase" :class="i === 1 ? 'text-pink-ink' : 'text-accent-ink'">Step {{ i + 1 }}</span></div>
          <h3 class="mt-4 font-semibold">{{ s[1] }}</h3><p class="text-sm text-muted mt-1.5 leading-relaxed">{{ s[2] }}</p>
        </li>
      </ol>
    </section>

    <!-- and more -->
    <section class="mt-20" aria-labelledby="more-h">
      <h2 id="more-h" class="text-2xl md:text-3xl font-semibold text-center">And the details that matter</h2>
      <ul class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <li v-for="m in more" :key="m.t" class="card !shadow-none p-5"><span class="size-10 rounded-lg bg-accent-soft text-accent-ink grid place-items-center"><Icon :name="m.icon" :size="20" /></span><h3 class="font-semibold mt-3">{{ m.t }}</h3><p class="text-sm text-muted mt-1 leading-relaxed">{{ m.d }}</p></li>
      </ul>
    </section>

    <slot name="ad" />

    <section class="mt-16 rounded-2xl bg-[#0B1437] text-white px-6 py-10 md:py-12 text-center">
      <h2 class="text-2xl md:text-3xl font-semibold">Try it in ten seconds</h2>
      <p class="text-white/70 mt-2">Open {{ name }} on two devices and start typing.</p>
      <div class="flex flex-wrap gap-2.5 justify-center mt-6">
        <component :is="Go" v-bind="goAttrs" class="btn btn-accent !min-h-11 px-6">Open {{ name }}</component>
        <button class="btn !min-h-11 px-6 !bg-white/10 !border-white/20 !text-white hover:!bg-white/20" @click="emit('feedback')">Tell us what you think</button>
      </div>
    </section>
  </div>
</template>
