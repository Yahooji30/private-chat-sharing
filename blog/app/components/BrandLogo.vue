<script setup lang="ts">
/** The Jodbox logo exactly as supplied: full lockup, or just the two-tablet mark. size = height in px. */
withDefaults(defineProps<{ size?: number; mark?: boolean }>(), { size: 36, mark: false })
const name = String(useRuntimeConfig().public.appName)
</script>

<template>
  <img v-if="mark" src="/logo-mark.webp" :alt="name" :height="size" :width="Math.round(size * 1.434)" class="block w-auto select-none" :style="{ height: `${size}px` }" draggable="false">
  <img v-else src="/logo.webp" :alt="name" :height="size" :width="Math.round(size * 4.05)" class="block w-auto select-none" :style="{ height: `${size}px` }" draggable="false">
</template>
