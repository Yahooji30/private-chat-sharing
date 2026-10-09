<script setup lang="ts">
const route = useRoute()
// remount per page so the canonical and prev/next tags follow ?page=
definePageMeta({ key: r => r.fullPath })
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const cfg = useRuntimeConfig()
const { data } = await useBlogFetch<ListResult>('blog:list', () => `/blog/articles?page=${page.value}`)
const { data: cats } = await useBlogFetch<{ slug: string; name: string; count: number }[]>('blog:cats', () => '/blog/categories')
await usePageSeo('blog', { title: `Blog | ${cfg.public.appName}`, description: `Guides, tips and news from ${cfg.public.appName}.`, path: page.value > 1 ? `/?page=${page.value}` : '/', adminCanonical: page.value === 1 })
const links = computed(() => {
  const base = `${cfg.public.siteUrl}/`
  const l: Record<string, string>[] = [{ rel: 'alternate', type: 'application/rss+xml', title: 'RSS', href: '/rss.xml' }]
  if (page.value > 1) l.push({ rel: 'prev', href: page.value > 2 ? `${base}?page=${page.value - 1}` : base })
  if (data.value && page.value < data.value.pages) l.push({ rel: 'next', href: `${base}?page=${page.value + 1}` })
  return l
})
// head link entries are plain attribute maps; the cast bridges unhead's strict union type
useHead({ link: links as unknown as never })
const featured = computed(() => (page.value === 1 ? data.value?.items[0] : undefined))
const rest = computed(() => (page.value === 1 ? (data.value?.items.slice(1) ?? []) : (data.value?.items ?? [])))
</script>

<template>
  <div class="pt-4 md:pt-8 pb-10">
    <h1 class="text-3xl md:text-4xl font-bold tracking-tight">Blog</h1>
    <nav v-if="cats?.length" class="flex gap-2 overflow-x-auto py-4 -mx-3 px-3 scroll-thin" aria-label="Categories">
      <NuxtLink to="/" class="btn !min-h-9 text-sm btn-soft shrink-0">All</NuxtLink>
      <NuxtLink v-for="c in cats" :key="c.slug" :to="`/category/${c.slug}`" class="btn !min-h-9 text-sm shrink-0">{{ c.name }}</NuxtLink>
    </nav>
    <p v-if="!data?.items.length" class="card p-10 text-center text-muted">No articles yet. Check back soon.</p>
    <BlogCard v-if="featured" :post="featured" big class="mb-5" />
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"><BlogCard v-for="p in rest" :key="p.slug" :post="p" /></div>
    <BlogPager v-if="data" :page="data.page" :pages="data.pages" base="/" />
  </div>
</template>
