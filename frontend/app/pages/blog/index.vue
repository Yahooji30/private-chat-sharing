<script setup lang="ts">
const route = useRoute()
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const name = String(useRuntimeConfig().public.appName)
const blogUrl = useApp().blogUrl
useAppSeo('blog', { title: `Blog | ${name}`, description: `Guides, tips and news from ${name}: sharing text and files between devices, privacy and productivity.` })
useHead({ link: blogUrl ? [{ rel: 'canonical', href: `${blogUrl}/` }] : [] })
const { data, pending } = await useBlogData<ListResult>('blog:list', () => `/blog/articles?page=${page.value}`)
const { data: cats } = await useBlogData<{ slug: string; name: string; count: number }[]>('blog:cats', () => '/blog/categories')
const featured = computed(() => (page.value === 1 ? data.value?.items[0] : undefined))
const rest = computed(() => (page.value === 1 ? (data.value?.items.slice(1) ?? []) : (data.value?.items ?? [])))
</script>

<template>
  <div class="pt-3 lg:pt-1 pb-8">
    <header>
      <p class="eyebrow">Blog</p>
      <h1 class="text-3xl md:text-4xl font-semibold mt-1">Guides and ideas for sharing smarter</h1>
      <p class="text-muted mt-2 max-w-2xl text-base md:text-lg">Tips, how-tos and news about moving text and files between your devices, privately and instantly.</p>
    </header>
    <nav v-if="cats?.length" class="flex gap-2 overflow-x-auto py-4 -mx-3 px-3 md:mx-0 md:px-0" aria-label="Categories">
      <NuxtLink to="/blog" class="btn !min-h-9 text-sm btn-soft shrink-0">All</NuxtLink>
      <NuxtLink v-for="c in cats.filter(x => x.count)" :key="c.slug" :to="`/blog/category/${c.slug}`" class="btn !min-h-9 text-sm shrink-0">{{ c.name }}</NuxtLink>
    </nav>
    <p v-if="pending && !data" class="text-muted flex items-center gap-2 py-10"><Icon name="refresh" class="animate-spin" />Loading...</p>
    <p v-else-if="!data?.items.length" class="card p-10 text-center text-muted">No articles yet. Check back soon.</p>
    <BlogCard v-if="featured" :post="featured" big class="mb-5" />
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
      <template v-for="(p, n) in rest" :key="p.slug">
        <BlogCard :post="p" />
        <AdSlot v-if="n === 3" kind="inline" class="sm:col-span-2 xl:col-span-3" />
      </template>
    </div>
    <BlogPager v-if="data" :page="data.page" :pages="data.pages" base="/blog" />
    <AdSlot kind="banner" class="mt-10" />
  </div>
</template>
