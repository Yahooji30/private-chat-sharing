<script setup lang="ts">
const props = defineProps<{ urls: string[]; newTab: boolean }>()
const emit = defineEmits<{ close: [] }>()
void props
const label = (u: string): string => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
</script>

<template>
  <section class="border-t border-line bg-surface-2/60 px-5 py-3 anim-pop" aria-label="Found URLs">
    <div class="flex items-center gap-2 mb-2">
      <h2 class="eyebrow">Found URLs</h2><span class="text-xs text-muted">opens in {{ newTab ? 'a new tab' : 'this tab' }}</span>
      <button class="ml-auto -mr-1.5 size-8 grid place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink" aria-label="Close URL panel" @click="emit('close')"><Icon name="x" :size="16" /></button>
    </div>
    <ul class="flex flex-wrap gap-2 max-h-28 overflow-y-auto scroll-thin">
      <li v-for="u in urls" :key="u" class="min-w-0 max-w-full">
        <a :href="hrefOf(u)" :target="newTab ? '_blank' : '_self'" rel="noopener noreferrer nofollow" :title="u" class="inline-flex items-center gap-1.5 max-w-full h-9 pl-2.5 pr-3 rounded-full bg-surface border border-line text-sm font-semibold text-accent-ink hover:border-[var(--accent)] transition-colors">
          <Icon name="external" :size="14" class="shrink-0" /><span class="truncate">{{ label(u) }}</span></a>
      </li>
    </ul>
  </section>
</template>
