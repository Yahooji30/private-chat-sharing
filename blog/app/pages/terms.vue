<script setup lang="ts">
const name = useRuntimeConfig().public.appName
await usePageSeo('terms', { title: `Terms | ${name}`, description: `The terms of using ${name}.`, path: '/terms' })
const { data: site } = await useBlogFetch<Record<string, string>>('site', () => '/site')
const custom = computed(() => site.value?.terms_html ?? '')
</script>

<template>
  <article class="max-w-2xl mx-auto pt-6 prose-page">
    <h1>Terms</h1>
    <div v-if="custom" v-html="custom" />
    <template v-else>
    <p>Last updated: <time datetime="2026-10-06">6 October 2026</time></p>
      <h2>Using the service</h2>
      <p>{{ name }} is provided as is. Do not use it to share unlawful content or to harm others. Public pages can be removed and reported by anyone.</p>
      <h2>Shared networks</h2>
      <p>Devices behind the same public IP address share a space. On public Wi-Fi or mobile carriers, unrelated people may share it. Do not put secrets in the shared text. Use secure chat for private conversations.</p>
    </template>
  </article>
</template>
