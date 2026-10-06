<script setup lang="ts">
const app = useApp()
const route = useRoute()
const name = useRuntimeConfig().public.appName
const nav = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/chat', label: 'Secure Chat', icon: 'chat' },
  { to: '/public', label: 'Public Pages', icon: 'globe' },
]
const active = (to: string): boolean => (to === '/' ? route.path === '/' : route.path.startsWith(to) || (to === '/chat' && route.path.startsWith('/c/')))
const isOnline = useOnline()
const chatRoute = computed(() => route.path.startsWith('/c/'))
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-line/60 md:border-0" :style="{ paddingTop: 'var(--safe-t)' }">
      <div class="mx-auto max-w-6xl px-4 h-14 md:h-16 flex items-center gap-3">
        <NuxtLink to="/" class="flex items-center gap-2 mr-auto md:mr-6" aria-label="Home">
          <img src="/icon.svg" alt="" width="34" height="34" class="rounded-[10px]">
          <span class="text-xl font-bold tracking-tight">{{ name }}<span class="text-accent">.</span></span>
        </NuxtLink>
        <nav class="hidden md:flex items-center gap-1 mr-auto" aria-label="Main">
          <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" class="px-3.5 h-10 inline-flex items-center gap-2 rounded-xl border text-[0.95rem] font-medium transition"
            :class="active(n.to) ? 'bg-accent-soft text-accent-ink border-accent/40' : 'border-transparent text-ink/80 hover:bg-surface-2'">
            <Icon :name="n.icon" :size="16" />{{ n.label }}
          </NuxtLink>
        </nav>
        <PresenceBadge />
        <button class="btn !px-0 w-10" aria-label="Toggle theme" @click="app.toggleTheme()">
          <Icon name="sun" class="dark:hidden" /><Icon name="moon" class="hidden dark:block" />
        </button>
        <button class="btn !px-0 w-10" aria-label="Settings" @click="app.openSettings()"><Icon name="settings" /></button>
      </div>
    </header>

    <main class="flex-1 w-full mx-auto max-w-6xl px-3 md:px-4" :class="chatRoute ? '' : 'pb-24 md:pb-6'">
      <div v-if="!isOnline || (!app.online && app.ready)" class="mb-2 rounded-xl bg-warn/20 border border-warn/50 text-sm px-3 py-2 flex items-center gap-2" role="status">
        <Icon name="wifi" :size="16" /> You are offline. Changes will sync when you reconnect.
      </div>
      <slot />
    </main>

    <footer class="hidden md:block text-center text-xs text-muted py-4">
      <NuxtLink to="/privacy" class="hover:underline">Privacy</NuxtLink> · <NuxtLink to="/terms" class="hover:underline">Terms</NuxtLink>
      <div id="ad-footer" />
    </footer>

    <nav v-if="!chatRoute" class="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe" aria-label="Main">
      <div class="grid grid-cols-4 px-2 pt-1.5">
        <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" class="flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[11px] font-medium"
          :class="active(n.to) ? 'text-accent-ink' : 'text-muted'">
          <span class="px-4 py-1 rounded-full transition" :class="active(n.to) ? 'bg-accent-soft' : ''"><Icon :name="n.icon" :size="20" /></span>{{ n.label.replace('Secure ', '').replace(' Pages', '') }}
        </NuxtLink>
        <button class="flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted" @click="app.openSettings('link')">
          <span class="px-4 py-1"><Icon name="link" :size="20" /></span>Link
        </button>
      </div>
    </nav>

    <SettingsModal />
    <ToastHost />
  </div>
</template>
