<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; statusMessage?: string; message?: string } }>()
const code = props.error.statusCode ?? 500
const text = props.error.statusMessage || props.error.message || (code === 404 ? 'Page not found' : 'Something went wrong')
</script>

<template>
  <div class="min-h-dvh grid place-items-center p-6 text-center">
    <div><p class="text-6xl font-bold text-accent-ink">{{ code }}</p><h1 class="text-2xl font-semibold mt-2">{{ text }}</h1>
      <div class="mt-6 flex gap-2 justify-center"><a href="/" class="btn btn-accent">Go to the blog</a><a href="/" class="btn">Reload</a></div></div>
  </div>
</template>
