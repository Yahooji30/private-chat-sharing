<script setup lang="ts">
const cfg = useRuntimeConfig()
const appUrl = String(cfg.public.appUrl).replace(/\/$/, '')
const year = new Date().getFullYear()
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-2 focus:left-2 btn btn-accent">Skip to the articles</a>
    <header class="sticky top-0 z-30 bg-bg/85 backdrop-blur-md border-b border-line/70" :style="{ paddingTop: 'var(--safe-t)' }">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
        <NuxtLink to="/" class="mr-auto shrink-0" aria-label="Blog home"><BrandLogo :size="36" /></NuxtLink>
        <ThemeToggle />
      </div>
    </header>

    <main id="main" class="flex-1 w-full mx-auto max-w-6xl px-4 sm:px-6"><slot /></main>

    <footer class="mt-10 border-t border-line bg-surface/70">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr] text-sm">
        <div><BrandLogo :size="38" /><p class="text-muted mt-3 max-w-xs leading-relaxed">Share text and files between your devices instantly. Private, fast, no sign-up.</p>
          <a :href="appUrl" class="btn btn-accent mt-4 !min-h-10 text-sm">Open the app<Icon name="external" :size="15" /></a></div>
        <div><p class="font-display font-semibold mb-2">Read</p><ul class="space-y-2 text-muted"><li><NuxtLink to="/" class="hover:text-accent-ink">All articles</NuxtLink></li><li><a :href="withBase('/rss.xml')" class="hover:text-accent-ink">RSS feed</a></li></ul></div>
        <div><p class="font-display font-semibold mb-2">Company</p><ul class="space-y-2 text-muted"><li><NuxtLink to="/feedback" class="hover:text-accent-ink">Feedback</NuxtLink></li><li><NuxtLink to="/privacy" class="hover:text-accent-ink">Privacy</NuxtLink></li><li><NuxtLink to="/terms" class="hover:text-accent-ink">Terms</NuxtLink></li></ul></div>
      </div>
      <p class="border-t border-line/70 text-center text-xs text-muted py-4 px-4" :style="{ paddingBottom: 'calc(1rem + var(--safe-b))' }">&copy; {{ year }} {{ String(cfg.public.appName) }}</p>
    </footer>
    <ToastHost />
  </div>
</template>
