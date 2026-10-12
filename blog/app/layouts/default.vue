<script setup lang="ts">
const cfg = useRuntimeConfig()
const name = cfg.public.appName
const appUrl = String(cfg.public.appUrl).replace(/\/$/, '')
const route = useRoute()
const links = [{ to: '/features', label: 'Features' }, { to: '/faq', label: 'FAQ' }, { to: '/', label: 'Blog' }, { to: '/feedback', label: 'Feedback' }]
const tabs = [[{ to: '/', label: 'Blog', icon: 'blog' }, { to: '/features', label: 'Features', icon: 'features' }], [{ to: '/faq', label: 'FAQ', icon: 'faq' }, { to: '/feedback', label: 'Feedback', icon: 'chat' }]]
const own = ['/features', '/faq', '/feedback', '/privacy', '/terms']
// "Blog" is lit for the blog home and for every article, category and tag
const here = (to: string): boolean => (to === '/' ? !own.includes(route.path) : route.path === to)
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header data-chrome class="sticky top-0 z-30 bg-bg/85 backdrop-blur-md border-b border-line/60" :style="{ paddingTop: 'var(--safe-t)' }">
      <div class="mx-auto max-w-6xl px-4 h-14 md:h-16 flex items-center gap-3">
        <NuxtLink to="/" class="mr-auto md:mr-4" aria-label="Blog home"><BrandLogo :size="40" /></NuxtLink>
        <nav class="hidden md:flex items-center gap-1.5 mr-auto" aria-label="Main">
          <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="px-4 h-10 inline-flex items-center rounded-2xl text-[0.95rem] font-semibold transition" :class="here(l.to) ? 'bg-accent-soft text-accent-ink' : 'text-ink/75 hover:bg-surface-2'">{{ l.label }}</NuxtLink>
        </nav>
        <a :href="appUrl" class="btn btn-accent !min-h-10 text-sm">Open the app</a>
      </div>
    </header>
    <main class="flex-1 w-full mx-auto max-w-6xl px-3 md:px-6"><slot /></main>
    <footer data-chrome class="mt-6 border-t border-line bg-surface/70 pb-20 md:pb-0">
      <div class="mx-auto max-w-6xl px-4 py-8 grid md:grid-cols-[1.4fr_1fr_1fr] gap-6 text-sm">
        <div><BrandLogo :size="40" /><p class="text-muted mt-3 max-w-xs leading-relaxed">Share text and files between your devices instantly. Private, fast, no sign-up.</p></div>
        <div><p class="font-display font-semibold mb-2">Explore</p><ul class="space-y-1.5 text-muted"><li><NuxtLink to="/" class="hover:text-accent-ink">Blog</NuxtLink></li><li><NuxtLink to="/features" class="hover:text-accent-ink">Features</NuxtLink></li><li><NuxtLink to="/faq" class="hover:text-accent-ink">FAQ</NuxtLink></li><li><a href="/rss.xml" class="hover:text-accent-ink">RSS</a></li></ul></div>
        <div><p class="font-display font-semibold mb-2">Company</p><ul class="space-y-1.5 text-muted"><li><NuxtLink to="/feedback" class="hover:text-accent-ink">Feedback</NuxtLink></li><li><NuxtLink to="/privacy" class="hover:text-accent-ink">Privacy</NuxtLink></li><li><NuxtLink to="/terms" class="hover:text-accent-ink">Terms</NuxtLink></li><li><a :href="appUrl" class="hover:text-accent-ink">Open the app</a></li></ul></div>
      </div>
    </footer>

    <!-- phone + tablet: tab bar pinned to the bottom, like the app -->
    <nav data-chrome class="md:hidden fixed z-30 bottom-0 inset-x-0 bg-surface border-t border-line" :style="{ paddingBottom: 'var(--safe-b)' }" aria-label="Main">
      <div class="grid grid-cols-5 items-stretch px-1 h-16">
        <NuxtLink v-for="t in tabs[0]" :key="t.to" :to="t.to" class="flex flex-col items-center justify-center gap-1 text-[11px] font-medium" :class="here(t.to) ? 'text-accent-ink' : 'text-muted'">
          <span class="h-8 w-14 rounded-full grid place-items-center transition-colors" :class="here(t.to) ? 'bg-accent-soft' : ''"><Icon :name="t.icon" :size="21" :weight="here(t.to) ? 'fill' : 'regular'" /></span>{{ t.label }}</NuxtLink>
        <a :href="appUrl" class="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-pink-ink" aria-label="Open the app"><span class="size-8 rounded-lg grid place-items-center text-white bg-pink"><Icon name="send" :size="18" weight="bold" /></span>Open app</a>
        <NuxtLink v-for="t in tabs[1]" :key="t.to" :to="t.to" class="flex flex-col items-center justify-center gap-1 text-[11px] font-medium" :class="here(t.to) ? 'text-accent-ink' : 'text-muted'">
          <span class="h-8 w-14 rounded-full grid place-items-center transition-colors" :class="here(t.to) ? 'bg-accent-soft' : ''"><Icon :name="t.icon" :size="21" :weight="here(t.to) ? 'fill' : 'regular'" /></span>{{ t.label }}</NuxtLink>
      </div>
    </nav>
    <ToastHost />
  </div>
</template>
