<script setup lang="ts">
const cfg = useRuntimeConfig()
const name = cfg.public.appName
const appUrl = String(cfg.public.appUrl).replace(/\/$/, '')
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header class="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-line/60">
      <div class="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
        <a :href="appUrl" class="flex items-center gap-2 mr-auto" aria-label="Open the app">
          <img src="/icon.svg" alt="" width="32" height="32" class="rounded-[10px]"><span class="text-xl font-bold tracking-tight">{{ name }}<span class="text-accent">.</span></span>
        </a>
        <NuxtLink to="/blog" class="btn !min-h-9 text-sm">Blog</NuxtLink>
        <a :href="appUrl" class="btn btn-accent !min-h-9 text-sm">Open the app</a>
      </div>
    </header>
    <main class="flex-1 w-full mx-auto max-w-6xl px-3 md:px-4"><slot /></main>
    <footer class="text-center text-xs text-muted py-6">
      <NuxtLink to="/privacy" class="hover:underline">Privacy</NuxtLink> · <NuxtLink to="/terms" class="hover:underline">Terms</NuxtLink> · <a href="/rss.xml" class="hover:underline">RSS</a>
    </footer>
    <ToastHost />
  </div>
</template>
