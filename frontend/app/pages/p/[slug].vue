<script setup lang="ts">
import { fmtAgo } from '~/utils/format'
const route = useRoute()
const slug = String(route.params.slug)
const cfg = useRuntimeConfig()
const hdr = import.meta.server ? useRequestHeaders(['x-forwarded-for', 'x-real-ip']) : {}
const { data: page, error } = await useAsyncData(`page:${slug}`, () =>
  $fetch<{ title: string; html: string; indexable: boolean; views: number; updatedAt: number }>(`${import.meta.server ? cfg.apiInternal : ''}/api/p/${encodeURIComponent(slug)}`, { headers: hdr }))
if (error.value) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
useHead({ title: () => page.value?.title ?? 'Page', meta: [{ name: 'robots', content: page.value?.indexable ? 'index, follow' : 'noindex, nofollow' }] })
const toast = useToast()
async function report(): Promise<void> {
  const reason = prompt('What is wrong with this page?')
  if (!reason || reason.trim().length < 3) return
  try { await api(`/p/${slug}/report`, { method: 'POST', body: { reason } }); toast.ok('Thanks, we will review it') } catch (e) { toast.err((e as Error).message) }
}
</script>

<template>
  <article v-if="page" class="max-w-2xl mx-auto pt-4 md:pt-8">
    <h1 class="text-3xl md:text-4xl font-bold tracking-tight">{{ page.title }}</h1>
    <p class="text-sm text-muted mt-2">Updated {{ fmtAgo(page.updatedAt) }} · {{ page.views }} view{{ page.views === 1 ? '' : 's' }}</p>
    <div class="prose-page mt-4 break-words" v-html="page.html" />
    <div class="mt-10 pt-4 border-t border-line flex items-center text-sm text-muted"><NuxtLink to="/" class="hover:underline">Made with {{ cfg.public.appName }}</NuxtLink>
      <button class="ml-auto hover:underline" @click="report">Report</button></div>
  </article>
</template>
