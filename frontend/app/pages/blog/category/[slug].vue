<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const name = String(useRuntimeConfig().public.appName)
const blogUrl = useApp().blogUrl
const key = 'category'
const { data, error } = await useBlogData<{ items: Card[]; page: number; pages: number; tag?: { name: string } }>(`blog:category:${slug.value}:${page.value}`, () => `/blog/articles?category=${encodeURIComponent(slug.value)}&page=${page.value}`)
const { data: cats } = await useBlogData<{ slug: string; name: string }[]>('blog:cats', () => '/blog/categories')
const title = computed(() => (key === 'tag' ? (data.value?.tag?.name ?? slug.value) : (cats.value?.find(c => c.slug === slug.value)?.name ?? slug.value)))
useSeoMeta({ title: () => `${title.value} | Blog | ${name}`, description: () => `Articles about ${title.value}.` })
useHead({ link: blogUrl ? [{ rel: 'canonical', href: `${blogUrl}/category/${slug.value}` }] : [] })
</script>

<template>
  <div class="pt-3 lg:pt-1 pb-8">
    <p class="text-sm text-muted"><NuxtLink to="/blog" class="hover:underline">Blog</NuxtLink> / category</p>
    <h1 class="text-3xl md:text-4xl font-semibold mt-1 mb-6">{{ key === 'tag' ? '#' : '' }}{{ title }}</h1>
    <p v-if="error || !data?.items.length" class="card p-10 text-center text-muted">Nothing here yet.</p>
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5"><BlogCard v-for="p in data?.items" :key="p.slug" :post="p" /></div>
    <BlogPager v-if="data" :page="data.page" :pages="data.pages" :base="`/blog/category/${slug}`" />
    <AdSlot kind="inline" class="mt-8" />
  </div>
</template>
