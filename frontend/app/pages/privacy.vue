<script setup lang="ts">
// Admin-written text (Admin > Site settings) when there is one, otherwise the built-in wording below.
const name = String(useRuntimeConfig().public.appName)
const blogUrl = useApp().blogUrl
useAppSeo('privacy', { title: `Privacy | ${name}`, description: `How ${name} handles your data: no raw IP addresses, encrypted text, peer-to-peer files and end-to-end encrypted chat.` })
useHead({ link: blogUrl ? [{ rel: 'canonical', href: `${blogUrl}/privacy` }] : [] })
const custom = ref('')
const loading = ref(true)
onMounted(async () => {
  try { custom.value = (await $fetch<Record<string, string>>('/api/site', { cache: 'no-cache' })).privacy_html ?? '' } catch { /* the built-in text shows */ }
  loading.value = false
})
</script>

<template>
  <article class="max-w-2xl mx-auto pt-3 lg:pt-1 pb-8 prose-page">
    <p class="eyebrow !m-0">Legal</p>
    <h1>Privacy</h1>
    <AdSlot kind="banner" class="!my-4 not-prose" />
    <p v-if="loading" class="text-muted">Loading...</p>
    <div v-else-if="custom" v-html="custom" />
    <template v-else>
      <p>Last updated: <time datetime="2026-10-06">6 October 2026</time></p>
      <h2>What we store</h2>
      <p>{{ name }} identifies a network by a keyed hash of its public IP address. We never store raw IP addresses. Text you type is encrypted at rest. Files travel directly between your devices and are never stored on our servers.</p>
      <h2>Secure chat</h2>
      <p>Chat messages are end-to-end encrypted in your browser. The server relays ciphertext only, keeps a short temporary buffer in memory, and deletes it when the room empties.</p>
      <h2>Cookies</h2>
      <p>One cookie identifies your device so linked devices and settings work. It is not used for tracking.</p>
    </template>
    <AdSlot kind="inline" class="mt-8" />
  </article>
</template>
