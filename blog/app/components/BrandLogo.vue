<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: number; mark?: boolean }>(), { size: 36, mark: true })
const name = String(useRuntimeConfig().public.appName)
const cut = Math.ceil(name.length / 2)
</script>

<template>
  <span class="inline-flex items-center gap-2 select-none">
    <img v-if="mark" src="/logo-mark.svg" alt="" :width="size * 1.23" :height="size" class="shrink-0" :style="{ height: `${size}px`, width: 'auto' }">
    <span class="leading-none" :style="{ fontSize: `${size * 0.78}px` }" :aria-label="name"><span class="wm-a">{{ name.slice(0, cut) }}</span><span class="wm-b">{{ name.slice(cut) }}</span></span>
  </span>
</template>
