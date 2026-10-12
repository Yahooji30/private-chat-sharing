<script setup lang="ts">
const app = useApp()
const route = useRoute()
const name = useRuntimeConfig().public.appName
const nav = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/chat', label: 'Secure Chat', icon: 'chat' },
  { to: '/public', label: 'Public Pages', icon: 'globe' },
]
const readPages = ['/read/features', '/read/faq', '/read/feedback', '/read/privacy', '/read/terms']
const active = (to: string): boolean => (to === '/' ? route.path === '/' : to === '/read' ? route.path.startsWith('/read') && !readPages.includes(route.path) : to.startsWith('/read') ? route.path === to : route.path.startsWith(to) || (to === '/chat' && route.path.startsWith('/c/')))
const isOnline = useOnline()
// the blog opens inside the app window (pages/read), so an installed PWA never jumps out to a browser tab
const external = computed(() => (app.blogUrl ? [{ to: '/read', label: 'Blog', icon: 'file' }] : []))
// content pages live on the SEO site; the phone's bottom bar is full, so these two get a place in the desktop bar and the footer
const more = computed(() => (app.blogUrl ? [{ to: '/read/features', label: 'Features', icon: 'check' }, { to: '/read/faq', label: 'FAQ', icon: 'alert' }] : []))
const chatRoute = computed(() => route.path.startsWith('/c/'))
const readRoute = computed(() => route.path.startsWith('/read'))
// the sidebar ad only belongs on content-style pages, never in a private chat
const rail = computed(() => route.path.startsWith('/public'))
const wide = computed(() => route.path === '/')
const tabs = computed(() => [nav[0]!, nav[1]!, { fab: true, label: 'Link' }, nav[2]!, ...external.value])
</script>

<template>
  <div class="min-h-dvh">
    <!-- desktop: a left rail instead of a top bar -->
    <aside class="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col gap-1 p-4 bg-surface/70 backdrop-blur border-r border-line z-30" aria-label="Sidebar">
      <NuxtLink to="/" class="px-2 py-3 mb-2" aria-label="Home"><BrandLogo :size="38" /></NuxtLink>
      <nav class="flex flex-col gap-1.5" aria-label="Main">
        <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" class="px-3.5 h-11 inline-flex items-center gap-3 rounded-2xl text-[0.98rem] font-bold transition"
          :class="active(n.to) ? 'bg-accent-soft text-accent-ink ' : 'text-ink/75 hover:bg-surface-2'">
          <Icon :name="n.icon" :size="19" />{{ n.label }}
        </NuxtLink>
        <NuxtLink v-for="e in [...external, ...more]" :key="e.to" :to="e.to" class="px-3.5 h-11 inline-flex items-center gap-3 rounded-2xl text-[0.98rem] font-semibold transition" :class="active(e.to) ? 'bg-accent-soft text-accent-ink' : 'text-ink/75 hover:bg-surface-2'"><Icon :name="e.icon" :size="19" />{{ e.label }}</NuxtLink>
      </nav>
      <div class="mt-auto space-y-3">
        <button class="w-full text-left rounded-2xl p-4 text-white bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] transition-colors" @click="app.openSettings('link')">
          <span class="flex items-center gap-2 font-display font-bold text-base"><Icon name="link" :size="18" />Link a device</span>
          <span class="block text-sm opacity-90 mt-1 leading-snug">Bring a phone on another network into this space with a code or QR.</span>
        </button>
        <div class="flex items-center gap-2"><PresenceBadge class="mr-auto" />
          <button class="btn !px-0 w-10" aria-label="Toggle theme" @click="app.toggleTheme()"><Icon name="sun" class="dark:hidden" /><Icon name="moon" class="hidden dark:block" /></button>
          <button class="btn !px-0 w-10" aria-label="Settings" @click="app.openSettings()"><Icon name="settings" /></button></div>
      </div>
    </aside>

    <div class="lg:pl-64 flex flex-col min-h-dvh">
      <!-- phone + tablet: compact app bar -->
      <header class="lg:hidden sticky top-0 z-30 bg-bg/85 backdrop-blur-md border-b border-line/60" :style="{ paddingTop: 'var(--safe-t)' }">
        <div class="mx-auto max-w-3xl px-4 h-14 md:h-16 flex items-center gap-2.5">
          <NuxtLink to="/" class="mr-auto" aria-label="Home"><BrandLogo :size="32" /></NuxtLink>
          <PresenceBadge />
          <button class="btn !px-0 w-10" aria-label="Toggle theme" @click="app.toggleTheme()"><Icon name="sun" class="dark:hidden" /><Icon name="moon" class="hidden dark:block" /></button>
          <button class="btn !px-0 w-10" aria-label="Settings" @click="app.openSettings()"><Icon name="settings" /></button>
        </div>
      </header>

      <div class="flex-1 w-full mx-auto px-3 md:px-6" :class="[chatRoute ? '' : 'lg:pt-6', rail && !chatRoute ? 'max-w-[1180px] xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-7' : wide ? 'max-w-[1180px]' : 'max-w-[920px]']">
        <main class="min-w-0 w-full mx-auto lg:max-w-none" :class="[wide ? '' : 'md:max-w-3xl', chatRoute ? '' : 'pb-6']">
          <div v-if="!isOnline || (app.hasConnected && !app.online)" class="mb-2 rounded-2xl bg-warn/20 border border-warn/50 text-sm px-3 py-2 flex items-center gap-2" role="status">
            <Icon name="wifi" :size="16" /> You are offline. Changes will sync when you reconnect.
          </div>
          <slot />
        </main>
        <aside v-if="rail && !chatRoute" class="hidden xl:block pt-1"><div class="sticky top-6"><AdSlot kind="rail" /></div></aside>
      </div>

      <footer class="text-center text-xs text-muted pt-2 pb-28 lg:pb-6" :class="chatRoute || readRoute ? 'hidden' : ''">
        <template v-if="app.blogUrl"><NuxtLink to="/read/features" class="hover:underline">Features</NuxtLink> · <NuxtLink to="/read/faq" class="hover:underline">FAQ</NuxtLink> · <NuxtLink to="/read/feedback" class="hover:underline">Feedback</NuxtLink> · <NuxtLink to="/read/privacy" class="hover:underline">Privacy</NuxtLink> · <NuxtLink to="/read/terms" class="hover:underline">Terms</NuxtLink></template>
      </footer>
    </div>

    <!-- phone + tablet: floating tab bar with a raised Link button -->
    <nav v-if="!chatRoute" class="lg:hidden fixed z-30 bottom-2.5 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[30rem] rounded-[28px] bg-surface/90 backdrop-blur-xl border border-line shadow-card" :style="{ marginBottom: 'var(--safe-b)' }" aria-label="Main">
      <div class="grid grid-cols-5 items-end px-1.5 py-1.5">
        <template v-for="t in tabs" :key="t.label">
          <button v-if="'fab' in t" class="flex flex-col items-center gap-0.5 text-[11px] font-bold text-pink-ink" aria-label="Link" @click="app.openSettings('link')">
            <span class="-mt-7 size-14 rounded-full grid place-items-center text-white btn-pink !p-0 ring-4 ring-surface"><Icon name="link" :size="24" /></span>Link
          </button>
          <NuxtLink v-else :to="t.to!" class="flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold" :class="active(t.to!) ? 'text-accent-ink' : 'text-muted'">
            <span class="px-4 py-1 rounded-full transition" :class="active(t.to!) ? 'bg-accent-soft' : ''"><Icon :name="t.icon!" :size="21" /></span>{{ t.label!.replace('Secure ', '').replace(' Pages', '') }}
          </NuxtLink>
        </template>
      </div>
    </nav>

    <LazySettingsModal v-if="app.settingsOpen" />
    <ToastHost />
  </div>
</template>
