<script setup lang="ts">
const route = useRoute()
const slug = String(route.params.slug)
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const cfg = useRuntimeConfig()
const { data, error } = await useBlogFetch<ListResult & { tag: { name: string } }>(`blog:tag:${slug}`, () => `/blog/tags/${encodeURIComponent(slug)}?page=${page.value}`)
if (error.value || !data.value) throw createError({ statusCode: 404, statusMessage: 'Tag not found', fatal: true })
const name = computed(() => data.value?.tag.name ?? slug)
useSeoMeta({ title: () => `#${name.value} | Blog | ${cfg.public.appName}`, description: () => `Articles tagged ${name.value}.` })
useHead({ link: [{ rel: 'canonical', href: `${cfg.public.siteUrl}/tag/${slug}` }] })
</script>

<template>
  <div class="pt-4 md:pt-8 pb-10">
    <p class="text-sm text-muted"><NuxtLink to="/" class="hover:underline">Blog</NuxtLink> / tag</p>
    <h1 class="text-3xl md:text-4xl font-bold tracking-tight mt-1 mb-6">#{{ name }}</h1>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"><BlogCard v-for="p in data?.items" :key="p.slug" :post="p" /></div>
    <BlogPager v-if="data" :page="data.page" :pages="data.pages" :base="`/tag/${slug}`" />
  </div>
</template>
