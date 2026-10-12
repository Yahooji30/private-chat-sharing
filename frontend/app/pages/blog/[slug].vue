<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const name = String(useRuntimeConfig().public.appName)
const blogUrl = useApp().blogUrl
const toast = useToast()
const { data: a, error, pending } = await useBlogData<Article>(`blog:article`, () => `/blog/articles/${encodeURIComponent(slug.value)}`)
const url = computed(() => (blogUrl ? `${blogUrl}/${slug.value}` : (import.meta.client ? location.href : '')))
useSeoMeta({
  title: () => `${a.value?.seoTitle || a.value?.title || 'Article'} | ${name}`, description: () => a.value?.seoDescription || a.value?.excerpt || '',
  ogTitle: () => a.value?.seoTitle || a.value?.title, ogDescription: () => a.value?.seoDescription || a.value?.excerpt, ogType: 'article',
})
// the server-rendered copy on the blog site is the one search engines index
useHead(() => ({ link: blogUrl ? [{ rel: 'canonical', href: `${blogUrl}/${slug.value}` }] : [] }))
// the in-article ad goes after the second paragraph, on a paragraph boundary
const parts = computed(() => {
  const html = a.value?.html ?? ''
  let at = -1
  for (let i = 0; i < 2; i++) { at = html.indexOf('</p>', at + 1); if (at < 0) return [html, ''] }
  return [html.slice(0, at + 4), html.slice(at + 4)]
})
const enc = encodeURIComponent
const shares = computed(() => [['WhatsApp', `https://wa.me/?text=${enc(`${a.value?.title ?? ''} ${url.value}`)}`], ['X', `https://twitter.com/intent/tweet?url=${enc(url.value)}&text=${enc(a.value?.title ?? '')}`],
  ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url.value)}`], ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url.value)}`]])
async function copy(): Promise<void> { if (await copyText(url.value)) toast.ok('Link copied') }
const tocOpen = ref(false)
</script>

<template>
  <div class="pt-3 lg:pt-1 pb-8">
    <p v-if="pending && !a" class="text-muted flex items-center gap-2 py-10"><Icon name="refresh" class="animate-spin" />Loading...</p>
    <div v-else-if="error || !a" class="card p-10 text-center space-y-3"><h1 class="text-xl font-semibold">Article not found</h1><p class="text-muted">It may have been moved or unpublished.</p><NuxtLink to="/blog" class="btn btn-accent">Back to the blog</NuxtLink></div>
    <article v-else class="grid xl:grid-cols-[minmax(0,72ch)_300px] gap-8 justify-center">
      <div class="min-w-0">
        <nav class="text-sm text-muted mb-3" aria-label="Breadcrumb"><NuxtLink to="/blog" class="hover:underline">Blog</NuxtLink><template v-if="a.category"> / <NuxtLink :to="`/blog/category/${a.category.slug}`" class="hover:underline">{{ a.category.name }}</NuxtLink></template></nav>
        <h1 class="text-3xl md:text-4xl font-semibold leading-tight">{{ a.title }}</h1>
        <p class="text-sm text-muted mt-3"><span v-if="a.author">{{ a.author }} · </span><time :datetime="a.publishedAt ?? ''">{{ fmtDate(a.publishedAt) }}</time> · {{ a.readingMin }} min read</p>
        <BlogCover v-if="a.cover" :cover="a.cover" eager class="mt-6 rounded-xl" />
        <details v-if="a.toc.length" class="xl:hidden card p-4 mt-6" :open="tocOpen" @toggle="tocOpen = ($event.target as HTMLDetailsElement).open"><summary class="font-semibold cursor-pointer">On this page</summary>
          <ul class="mt-2 space-y-1.5 text-sm"><li v-for="t in a.toc" :key="t.id" :class="t.level === 3 ? 'pl-4' : ''"><a :href="`#${t.id}`" class="text-accent-ink hover:underline" @click="tocOpen = false">{{ t.text }}</a></li></ul></details>
        <div class="prose-page prose-article mt-6 text-[1.02rem]" v-html="parts[0]" />
        <AdSlot v-if="parts[1]" kind="inline" class="my-6" />
        <div v-if="parts[1]" class="prose-page prose-article text-[1.02rem]" v-html="parts[1]" />
        <div v-if="a.tags.length" class="flex flex-wrap gap-2 mt-8"><NuxtLink v-for="t in a.tags" :key="t.slug" :to="`/blog/tag/${t.slug}`" class="btn !min-h-8 text-sm">#{{ t.name }}</NuxtLink></div>
        <div class="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-line"><span class="text-sm text-muted mr-1">Share</span>
          <a v-for="s in shares" :key="s[0]" :href="s[1]" target="_blank" rel="noopener noreferrer" class="btn !min-h-9 text-sm">{{ s[0] }}</a><button class="btn !min-h-9 text-sm" @click="copy"><Icon name="copy" :size="15" />Copy link</button></div>
        <AdSlot kind="inline" class="mt-8" />
        <section v-if="a.related.length" class="mt-12"><h2 class="text-xl font-semibold mb-4">Related articles</h2><div class="grid sm:grid-cols-2 gap-4"><BlogCard v-for="r in a.related" :key="r.slug" :post="r" /></div></section>
      </div>
      <aside class="hidden xl:block"><div class="sticky top-6 space-y-4">
        <nav v-if="a.toc.length" class="card p-4" aria-label="Table of contents"><p class="font-semibold mb-2 text-sm">On this page</p>
          <ul class="space-y-1.5 text-sm"><li v-for="t in a.toc" :key="t.id" :class="t.level === 3 ? 'pl-3' : ''"><a :href="`#${t.id}`" class="text-muted hover:text-accent-ink">{{ t.text }}</a></li></ul></nav>
        <AdSlot kind="rail" />
      </div></aside>
    </article>
  </div>
</template>
