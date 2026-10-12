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
  <div class="pt-5 md:pt-10 pb-10">
    <section class="relative overflow-hidden rounded-[28px] p-6 md:p-10 text-white bg-[linear-gradient(135deg,var(--blue-hi),var(--blue)_55%,var(--pink))] shadow-[0_20px_50px_-20px_rgb(0_88_240/.6)]">
      <span class="chip !bg-white/20 !text-white">Blog</span>
      <h1 class="text-3xl md:text-5xl font-bold tracking-tight mt-3 max-w-2xl leading-tight">Guides and ideas for sharing smarter</h1>
      <p class="mt-3 text-white/90 max-w-xl md:text-lg">Tips, how-tos and news about moving text and files between your devices, privately and instantly.</p>
      <svg class="absolute -right-6 -bottom-8 w-44 md:w-64 opacity-25" viewBox="0 0 128 104" fill="none" aria-hidden="true"><rect x="8" y="8" width="44" height="88" rx="14" stroke="#fff" stroke-width="10"/><rect x="76" y="8" width="44" height="88" rx="14" stroke="#fff" stroke-width="10"/></svg>
    </section>
    <nav v-if="cats?.length" class="flex gap-2 overflow-x-auto py-4 -mx-3 px-3 md:mx-0 md:px-0 scroll-thin" aria-label="Categories">
      <NuxtLink to="/" class="btn !min-h-9 text-sm btn-soft shrink-0">All</NuxtLink>
      <NuxtLink v-for="c in cats" :key="c.slug" :to="`/category/${c.slug}`" class="btn !min-h-9 text-sm shrink-0">{{ c.name }}</NuxtLink>
    </nav>
    <AdSlot kind="banner" class="mb-6" />
    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <div class="min-w-0">
        <p v-if="!data?.items.length" class="card p-10 text-center text-muted">No articles yet. Check back soon.</p>
        <BlogCard v-if="featured" :post="featured" big class="mb-5" />
        <div class="grid sm:grid-cols-2 gap-4 md:gap-5">
          <template v-for="(p, n) in rest" :key="p.slug">
            <BlogCard :post="p" />
            <AdSlot v-if="n === 3" kind="inline" class="sm:col-span-2" />
          </template>
        </div>
        <BlogPager v-if="data" :page="data.page" :pages="data.pages" base="/" />
      </div>
      <aside class="hidden lg:block"><div class="sticky top-24 space-y-5"><AdSlot kind="rail" /></div></aside>
    </div>
  </div>
</template>
