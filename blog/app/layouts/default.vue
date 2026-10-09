<script setup lang="ts">
const cfg = useRuntimeConfig()
const name = cfg.public.appName
const appUrl = String(cfg.public.appUrl).replace(/\/$/, '')
const route = useRoute()
const links = [{ to: '/features', label: 'Features' }, { to: '/faq', label: 'FAQ' }, { to: '/', label: 'Blog' }, { to: '/feedback', label: 'Feedback' }]
const own = ['/features', '/faq', '/feedback', '/privacy', '/terms']
// "Blog" is lit for the blog home and for every article, category, tag and public page
const here = (to: string): boolean => (to === '/' ? !own.includes(route.path) : route.path === to)
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-line/60">
      <div class="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
        <a :href="appUrl" class="flex items-center gap-2 mr-auto" aria-label="Open the app">
          <img src="/icon.svg" alt="" width="32" height="32" class="rounded-[10px]"><span class="text-xl font-bold tracking-tight">{{ name }}<span class="text-accent">.</span></span>
        </a>
        <nav class="hidden md:flex items-center gap-1" aria-label="Main">
          <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="btn !min-h-9 text-sm" :class="here(l.to) ? 'btn-soft' : '!border-transparent !bg-transparent hover:!bg-surface-2'">{{ l.label }}</NuxtLink>
        </nav>
        <a :href="appUrl" class="btn btn-accent !min-h-9 text-sm">Open the app</a>
      </div>
      <nav class="md:hidden flex gap-1.5 overflow-x-auto scroll-thin px-3 pb-2" aria-label="Main">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="btn !min-h-8 text-sm shrink-0" :class="here(l.to) ? 'btn-soft' : ''">{{ l.label }}</NuxtLink>
      </nav>
    </header>
    <main class="flex-1 w-full mx-auto max-w-6xl px-3 md:px-4"><slot /></main>
    <footer class="text-center text-xs text-muted py-6">
      <NuxtLink to="/features" class="hover:underline">Features</NuxtLink> · <NuxtLink to="/faq" class="hover:underline">FAQ</NuxtLink> · <NuxtLink to="/feedback" class="hover:underline">Feedback</NuxtLink> · <NuxtLink to="/privacy" class="hover:underline">Privacy</NuxtLink> · <NuxtLink to="/terms" class="hover:underline">Terms</NuxtLink> · <a href="/rss.xml" class="hover:underline">RSS</a>
    </footer>
    <ToastHost />
  </div>
</template>
