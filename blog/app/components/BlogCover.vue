<script setup lang="ts">
import type { Cover } from '~/composables/useBlog'
const props = defineProps<{ cover: Cover; sizes?: string; eager?: boolean }>()
const largest = computed(() => props.cover.variants.at(-1))
const srcset = computed(() => props.cover.variants.map(v => `${mediaUrl(v)} ${v.w}w`).join(', '))
</script>

<template>
  <img v-if="largest" :src="mediaUrl(largest)" :srcset="srcset" :sizes="sizes ?? '(min-width: 768px) 720px, 100vw'" :width="largest.w" :height="largest.h" :alt="cover.alt"
    :loading="eager ? 'eager' : 'lazy'" :fetchpriority="eager ? 'high' : 'auto'" decoding="async" class="w-full h-auto rounded-2xl bg-surface-2 object-cover" :style="{ aspectRatio: `${largest.w} / ${largest.h}` }">
</template>
