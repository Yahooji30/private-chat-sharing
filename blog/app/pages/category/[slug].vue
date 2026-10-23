<script setup lang="ts">
import { MIN_TERM_ARTICLES } from '@sync/shared'
const route = useRoute()
const slug = String(route.params.slug)
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const cfg = useRuntimeConfig()
const { data, error } = await useBlogFetch<ListResult>(`blog:category:${slug}`, () => `/blog/articles?category=${encodeURIComponent(slug)}&page=${page.value}`)
const { data: cats } = await useBlogFetch<{ slug: string; name: string }[]>('blog:cats', () => '/blog/categories')
const name = computed(() => cats.value?.find(c => c.slug === slug)?.name ?? slug)
if (error.value || (cats.value && !cats.value.some(c => c.slug === slug))) throw createError({ statusCode: 404, statusMessage: 'Category not found', fatal: true })
useSeoMeta({ title: () => `${name.value} | Blog | ${cfg.public.appName}`, description: () => `Articles about ${name.value}.` })
// a category with only a few articles just repeats them: kept out of search results (and out of the sitemap) until it has enough
const thin = (data.value?.total ?? 0) < MIN_TERM_ARTICLES
useHead({ link: [{ rel: 'canonical', href: `${cfg.public.siteUrl}/category/${slug}` }], meta: thin ? [{ name: 'robots', content: 'noindex, follow' }] : [] })
</script>

<template>
  <div class="pt-4 md:pt-8 pb-10">
    <p class="text-sm text-muted"><NuxtLink to="/" class="hover:underline">Blog</NuxtLink> / category</p>
    <h1 class="text-3xl md:text-4xl font-semibold tracking-tight mt-1 mb-6">{{ name }}</h1>
    <p v-if="!data?.items.length" class="card p-10 text-center text-muted">Nothing here yet.</p>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"><BlogCard v-for="p in data?.items" :key="p.slug" :post="p" /></div>
    <BlogPager v-if="data" :page="data.page" :pages="data.pages" :base="`/category/${slug}`" />
  </div>
</template>
