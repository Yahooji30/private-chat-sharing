<script setup lang="ts">
defineProps<{ urls: string[]; newTab: boolean }>()
const host = (u: string): string => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0] ?? u
const rest = (u: string): string => { const t = u.replace(/^https?:\/\//i, '').replace(/^www\./i, ''); return t.slice(host(u).length).replace(/\/$/, '') }
</script>

<template>
  <div>
    <div class="flex items-baseline gap-2 mb-2 px-1">
      <h2 class="font-semibold text-base">Found URLs</h2><span v-if="urls.length" class="chip">{{ urls.length }}</span>
      <span class="ml-auto text-xs text-muted">opens in {{ newTab ? 'a new tab' : 'this tab' }}</span>
    </div>
    <ul v-if="urls.length" class="space-y-2">
      <li v-for="u in urls" :key="u">
        <a :href="hrefOf(u)" :target="newTab ? '_blank' : '_self'" rel="noopener noreferrer nofollow" :title="u" class="card !shadow-none flex items-center gap-3 px-3.5 py-3 hover:border-[var(--accent)] transition-colors">
          <span class="size-9 rounded-lg bg-accent-soft text-accent-ink grid place-items-center shrink-0"><Icon name="link" :size="18" /></span>
          <span class="min-w-0 flex-1"><span class="block font-medium truncate">{{ host(u) }}</span><span v-if="rest(u)" class="block text-xs text-muted truncate">{{ rest(u) }}</span></span>
          <Icon name="external" :size="16" class="text-muted shrink-0" />
        </a>
      </li>
    </ul>
    <p v-else class="card !shadow-none px-4 py-6 text-sm text-muted text-center">No links yet. Type or paste a web address and it shows up here.</p>
  </div>
</template>
