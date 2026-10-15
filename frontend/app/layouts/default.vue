<script setup lang="ts">
const app = useApp()
const route = useRoute()
const isOnline = useOnline()
const base = [{ to: '/', label: 'Home', icon: 'home' }, { to: '/chat', label: 'Secure Chat', icon: 'chat' }]
// Blog, Features and FAQ are native pages of the app. The server-rendered blog site is the copy search engines index; these pages point to it with a canonical link.
const pages = computed(() => [{ to: '/blog', label: 'Blog', icon: 'blog' }, { to: '/features', label: 'Features', icon: 'features' }, { to: '/faq', label: 'FAQ', icon: 'faq' }])
const side = computed(() => [...base, ...pages.value])
const active = (to: string): boolean => (to === '/' ? route.path === '/' : route.path.startsWith(to) || (to === '/chat' && route.path.startsWith('/c/')))
const chatRoute = computed(() => route.path.startsWith('/c/'))
const feedback = useState('feedback-open', () => false)
const wide = computed(() => route.path === '/')
// phone + tablet tab bar: Home, Chat, the raised Link button, then the first two site pages
const tabs = computed(() => [base[0]!, base[1]!, { fab: true, label: 'Link' }, ...pages.value.slice(0, 2)])
const footer = [['Features', '/features'], ['FAQ', '/faq'], ['Privacy', '/privacy'], ['Terms', '/terms']] as const
</script>

<template>
  <div class="min-h-dvh">
    <!-- desktop: a left rail instead of a top bar -->
    <aside class="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col gap-1 p-4 bg-surface border-r border-line z-30" aria-label="Sidebar">
      <NuxtLink to="/" class="px-2 pt-2 pb-5" aria-label="Home"><BrandLogo :size="50" /></NuxtLink>
      <nav class="flex flex-col gap-1" aria-label="Main">
        <NuxtLink v-for="n in side" :key="n.to" :to="n.to" class="px-3 h-10 inline-flex items-center gap-3 rounded-lg text-[0.9375rem] font-medium transition-colors"
          :class="active(n.to) ? 'bg-accent-soft text-accent-ink' : 'text-ink/70 hover:bg-surface-2 hover:text-ink'">
          <Icon :name="n.icon" :size="20" :weight="active(n.to) ? 'fill' : 'regular'" />{{ n.label }}
        </NuxtLink>
      </nav>
      <button class="mt-1 px-3 h-10 inline-flex items-center gap-3 rounded-lg text-[0.9375rem] font-medium text-ink/70 hover:bg-surface-2 hover:text-ink transition-colors" @click="feedback = true"><Icon name="mail" :size="20" />Send feedback</button>
      <div class="mt-auto space-y-3">
        <button class="w-full text-left rounded-xl p-4 text-white bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] transition-colors" @click="app.openSettings('link')">
          <span class="flex items-center gap-2 font-semibold text-[0.9375rem]"><Icon name="link" :size="18" weight="bold" />Link a device</span>
          <span class="block text-[0.8125rem] opacity-90 mt-1 leading-snug">Bring a phone on another network into this space with a code or QR.</span>
        </button>
        <div class="flex items-center gap-2"><PresenceBadge class="mr-auto" />
          <button class="btn !px-0 w-10" aria-label="Toggle theme" @click="app.toggleTheme()"><Icon name="sun" class="dark:hidden" /><Icon name="moon" class="hidden dark:block" /></button>
          <button class="btn !px-0 w-10" aria-label="Settings" @click="app.openSettings()"><Icon name="settings" /></button></div>
      </div>
    </aside>

    <div class="lg:pl-64 flex flex-col min-h-dvh">
      <!-- phone + tablet: compact app bar -->
      <header class="lg:hidden sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-line" :style="{ paddingTop: 'var(--safe-t)' }">
        <div class="mx-auto max-w-3xl px-4 h-14 md:h-16 flex items-center gap-2.5">
          <NuxtLink to="/" class="mr-auto" aria-label="Home"><BrandLogo :size="34" /></NuxtLink>
          <PresenceBadge />
          <button class="btn !px-0 w-10" aria-label="Toggle theme" @click="app.toggleTheme()"><Icon name="sun" class="dark:hidden" /><Icon name="moon" class="hidden dark:block" /></button>
          <button class="btn !px-0 w-10" aria-label="Settings" @click="app.openSettings()"><Icon name="settings" /></button>
        </div>
      </header>

      <div class="flex-1 w-full mx-auto px-3 md:px-6" :class="[chatRoute ? '' : 'lg:pt-6', wide ? 'max-w-[1180px]' : 'max-w-[920px]']">
        <main class="min-w-0 w-full mx-auto lg:max-w-none" :class="[wide ? '' : 'md:max-w-3xl', chatRoute ? '' : 'pb-6']">
          <div v-if="!isOnline || (app.hasConnected && !app.online)" class="mb-2 rounded-xl bg-warn/20 border border-warn/50 text-sm px-3 py-2 flex items-center gap-2" role="status">
            <Icon name="wifi" :size="16" /> You are offline. Changes will sync when you reconnect.
          </div>
          <slot />
        </main>
      </div>

      <footer class="text-center text-xs text-muted pt-2 pb-24 lg:pb-6" :class="chatRoute ? 'hidden' : ''">
        <template v-for="f in footer" :key="f[1]"><NuxtLink :to="f[1]" class="hover:underline">{{ f[0] }}</NuxtLink> · </template><button class="hover:underline" @click="feedback = true">Feedback</button>
      </footer>
    </div>

    <!-- phone + tablet: tab bar pinned to the bottom, nothing floats over the content -->
    <nav v-if="!chatRoute" class="lg:hidden fixed z-30 bottom-0 inset-x-0 bg-surface border-t border-line" :style="{ paddingBottom: 'var(--safe-b)' }" aria-label="Main">
      <div class="mx-auto max-w-lg grid items-stretch px-1 h-16" :style="{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }">
        <template v-for="t in tabs" :key="t.label">
          <button v-if="'fab' in t" class="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-pink-ink" aria-label="Link device" @click="app.openSettings('link')">
            <span class="size-8 rounded-lg grid place-items-center text-white bg-pink"><Icon name="link" :size="18" weight="bold" /></span>Link device
          </button>
          <NuxtLink v-else :to="t.to!" class="flex flex-col items-center justify-center gap-1 text-[11px] font-medium" :class="active(t.to!) ? 'text-accent-ink' : 'text-muted'">
            <span class="h-8 w-14 rounded-full grid place-items-center transition-colors" :class="active(t.to!) ? 'bg-accent-soft' : ''"><Icon :name="t.icon!" :size="21" :weight="active(t.to!) ? 'fill' : 'regular'" /></span>{{ t.label!.replace('Secure ', '') }}
          </NuxtLink>
        </template>
      </div>
    </nav>

    <LazySettingsModal v-if="app.settingsOpen" />
    <PwaPrompt />
    <FeedbackModal />
    <ConfirmDialog />
    <ToastHost />
  </div>
</template>
