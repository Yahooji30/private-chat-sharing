<script setup lang="ts">
const cfg = useRuntimeConfig()
const name = String(cfg.public.appName)
const appUrl = String(cfg.public.appUrl).replace(/\/$/, '')
const origin = String(cfg.public.siteUrl).replace(/\/$/, '')

const features = [
  { icon: 'refresh', title: 'Live text sync', text: 'Type or paste on one device and it appears on every other device on your network instantly. Edits sync both ways, and work you do offline is sent as soon as you reconnect.' },
  { icon: 'upload', title: 'Device-to-device file transfer', text: 'Drop in files and they travel straight from device to device over WebRTC. Nothing is uploaded to our servers, big files resume after a drop, and every block is verified.' },
  { icon: 'qr', title: 'Link any device, anywhere', text: 'A phone on mobile data? Scan a QR code, type a short code or share a link and it joins your space in seconds. Unlink any time.' },
  { icon: 'lock', title: 'Secure private chat', text: 'Password-protected rooms for up to four people. Messages are encrypted in your browser, there is no history for newcomers, and the room is wiped when the last person leaves.' },
  { icon: 'share', title: 'Invite with one tap', text: 'Share a secret chat link through WhatsApp, Telegram, email or any app, with a ready-made message. The password is shared separately, so the link alone is useless.' },
  { icon: 'globe', title: 'Public pages', text: 'Publish a Markdown page at a short link in a minute and keep editing it later with a private edit link. Choose whether search engines may index it.' },
  { icon: 'link', title: 'Found links panel', text: 'Every web address in your shared text is collected in a tidy panel, so you can open links from your laptop on your phone without copying anything.' },
  { icon: 'shield', title: 'Private by design', text: 'No sign-up and no accounts. Networks are identified by a keyed hash of the IP address, never the address itself, and your text is encrypted at rest.' },
  { icon: 'phone', title: 'Installs like an app', text: 'Add it to your home screen on Android, iPhone or desktop. It opens instantly, works offline for the basics, and appears in the share menu of other apps.' },
]
const steps = [
  ['Open the app', 'On any device on the same Wi-Fi or network. No account, nothing to install.'],
  ['Type or drop files', 'Text shows up everywhere right away. Files go directly between your devices.'],
  ['Link or chat securely', 'Bring in other networks with a code, or start an encrypted room that vanishes.'],
]

await usePageSeo('features', {
  title: `Features | ${name}`,
  description: `Everything ${name} does: live text sync, device-to-device file transfer, QR linking, end-to-end encrypted chat rooms, public pages and more. Free, private, no sign-up.`,
  path: '/features',
  schema: [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name, url: appUrl, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: features.map(f => f.title) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: origin }, { '@type': 'ListItem', position: 2, name: 'Features', item: `${origin}/features` }] },
  ],
})
</script>

<template>
  <div class="pt-6 md:pt-10 pb-12">
    <header class="max-w-3xl">
      <h1 class="text-3xl md:text-5xl font-bold tracking-tight leading-tight">Everything you need to move things between devices</h1>
      <p class="text-muted mt-3 text-lg">{{ name }} is free, private and works in the browser. Here is what is inside.</p>
      <div class="flex flex-wrap gap-2 mt-5"><a :href="appUrl" class="btn btn-accent !min-h-11 px-5">Open the app</a><NuxtLink to="/faq" class="btn !min-h-11 px-5">Read the FAQ</NuxtLink></div>
    </header>

    <ul class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10" aria-label="Features">
      <li v-for="f in features" :key="f.title" class="card p-5">
        <span class="size-11 rounded-xl bg-accent-soft text-accent-ink grid place-items-center mb-3"><Icon :name="f.icon" :size="22" /></span>
        <h2 class="font-semibold text-lg">{{ f.title }}</h2>
        <p class="text-sm text-muted mt-1.5 leading-relaxed">{{ f.text }}</p>
      </li>
    </ul>

    <section class="mt-14" aria-labelledby="how">
      <h2 id="how" class="text-2xl font-bold tracking-tight">How it works</h2>
      <ol class="grid sm:grid-cols-3 gap-4 mt-5">
        <li v-for="(s, i) in steps" :key="s[0]" class="card p-5"><span class="size-8 rounded-full bg-accent-soft text-accent-ink grid place-items-center font-bold mb-2">{{ i + 1 }}</span><strong>{{ s[0] }}</strong><p class="text-sm text-muted mt-1">{{ s[1] }}</p></li>
      </ol>
    </section>

    <section class="card p-6 md:p-8 mt-14 text-center">
      <h2 class="text-2xl font-bold tracking-tight">Try it in ten seconds</h2>
      <p class="text-muted mt-1">Open it on two devices and start typing.</p>
      <div class="flex flex-wrap gap-2 justify-center mt-4"><a :href="appUrl" class="btn btn-accent !min-h-11 px-6">Open the app</a><NuxtLink to="/feedback" class="btn !min-h-11 px-6">Tell us what you think</NuxtLink></div>
    </section>
  </div>
</template>
