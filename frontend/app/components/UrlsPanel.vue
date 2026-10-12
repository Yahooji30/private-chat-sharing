<script setup lang="ts">
defineProps<{ urls: string[]; newTab: boolean; bare?: boolean }>()
const toast = useToast()
const host = (u: string): string => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0] ?? u
const rest = (u: string): string => { const t = u.replace(/^https?:\/\//i, '').replace(/^www\./i, ''); return t.slice(host(u).length).replace(/\/$/, '') }
async function copy(u: string): Promise<void> { if (await copyText(hrefOf(u))) toast.ok('Link copied') }
</script>

<template>
  <div>
    <div v-if="!bare" class="flex items-baseline gap-2 mb-2 px-1">
      <h2 class="font-semibold text-base">Found URLs</h2><span v-if="urls.length" class="chip">{{ urls.length }}</span>
      <span class="ml-auto text-xs text-muted">opens in {{ newTab ? 'a new tab' : 'this tab' }}</span>
    </div>
    <p v-else class="sr-only">Found URLs</p>
    <ul v-if="urls.length" class="space-y-2">
      <li v-for="u in urls" :key="u" class="card !shadow-none flex items-stretch overflow-hidden">
        <a :href="hrefOf(u)" :target="newTab ? '_blank' : '_self'" rel="noopener noreferrer nofollow" :title="u" class="flex-1 min-w-0 flex items-center gap-3 pl-3.5 pr-2 py-3 min-h-[3.75rem] hover:bg-surface-2 active:bg-surface-2 transition-colors">
          <span class="size-9 rounded-lg bg-accent-soft text-accent-ink grid place-items-center shrink-0"><Icon name="link" :size="18" /></span>
          <span class="min-w-0 flex-1"><span class="block font-medium truncate">{{ host(u) }}</span><span v-if="rest(u)" class="block text-xs text-muted truncate">{{ rest(u) }}</span></span>
          <Icon name="external" :size="16" class="text-muted shrink-0" />
        </a>
        <button class="w-12 shrink-0 grid place-items-center border-l border-line text-muted hover:text-ink hover:bg-surface-2 active:bg-surface-2 transition-colors" :aria-label="`Copy ${host(u)}`" @click="copy(u)"><Icon name="copy" :size="18" /></button>
      </li>
    </ul>
    <p v-else class="card !shadow-none px-4 py-6 text-sm text-muted text-center">No links yet. Type or paste a web address and it shows up here.</p>
  </div>
</template>
