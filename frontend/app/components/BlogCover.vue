<script setup lang="ts">
import type { Cover } from '~/composables/useBlog'
const props = defineProps<{ cover: Cover; sizes?: string; eager?: boolean; fill?: boolean }>()
const largest = computed(() => props.cover.variants.at(-1))
const srcset = computed(() => props.cover.variants.map(v => `${mediaUrl(v)} ${v.w}w`).join(', '))
</script>

<template>
  <img v-if="largest" :src="mediaUrl(largest)" :srcset="srcset" :sizes="sizes ?? '(min-width: 768px) 720px, 100vw'" :width="largest.w" :height="largest.h" :alt="cover.alt"
    :loading="eager ? 'eager' : 'lazy'" decoding="async" class="w-full bg-surface-2 object-cover" :class="fill ? 'h-full' : 'h-auto'" :style="fill ? undefined : { aspectRatio: `${largest.w} / ${largest.h}` }">
</template>
