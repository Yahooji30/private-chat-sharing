<script setup lang="ts">
// Admin-written text (Admin > Site settings) when there is one, otherwise the built-in wording below.
const name = String(useRuntimeConfig().public.appName)
const blogUrl = useApp().blogUrl
useAppSeo('terms', { title: `Terms | ${name}`, description: `The terms of using ${name}.` })
useHead({ link: blogUrl ? [{ rel: 'canonical', href: `${blogUrl}/terms` }] : [] })
const custom = ref('')
const loading = ref(true)
onMounted(async () => {
  try { custom.value = (await $fetch<Record<string, string>>('/api/site', { cache: 'no-cache' })).terms_html ?? '' } catch { /* the built-in text shows */ }
  loading.value = false
})
</script>

<template>
  <article class="max-w-2xl mx-auto pt-3 lg:pt-1 pb-8 prose-page">
    <p class="eyebrow !m-0">Legal</p>
    <h1>Terms</h1>
    <p v-if="loading" class="text-muted">Loading...</p>
    <div v-else-if="custom" v-html="custom" />
    <template v-else>
      <p>Last updated: <time datetime="2026-10-06">6 October 2026</time></p>
      <h2>Using the service</h2>
      <p>{{ name }} is provided as is. Do not use it to share unlawful content or to harm others.</p>
      <h2>Shared networks</h2>
      <p>Devices behind the same public IP address share a space. On public Wi-Fi or mobile carriers, unrelated people may share it. Do not put secrets in the shared text. Use secure chat for private conversations.</p>
    </template>
  </article>
</template>
