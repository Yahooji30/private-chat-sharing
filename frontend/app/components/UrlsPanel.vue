<script setup lang="ts">
const props = defineProps<{ urls: string[]; newTab: boolean }>()
const emit = defineEmits<{ close: [] }>()
void props
</script>

<template>
  <section class="card p-4 mb-3 anim-pop" aria-label="Found URLs">
    <div class="flex items-start">
      <div>
        <h2 class="text-xs font-bold uppercase tracking-wide">Found URLs</h2>
        <p class="text-xs text-muted">Click to open in {{ newTab ? 'new tab' : 'this tab' }}</p>
      </div>
      <button class="ml-auto -mt-1 -mr-1 size-9 grid place-items-center rounded-lg hover:bg-surface-2" aria-label="Close URL panel" @click="emit('close')"><Icon name="x" :size="18" /></button>
    </div>
    <ul class="mt-2 max-h-44 overflow-y-auto scroll-thin space-y-0.5">
      <li v-for="u in urls" :key="u">
        <a :href="hrefOf(u)" :target="newTab ? '_blank' : '_self'" rel="noopener noreferrer nofollow" class="block py-2 px-1 text-accent-ink hover:underline break-all">{{ u }}</a>
      </li>
    </ul>
  </section>
</template>
