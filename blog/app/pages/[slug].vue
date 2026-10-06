<script setup lang="ts">
const route = useRoute()
const slug = String(route.params.slug)
const cfg = useRuntimeConfig()
const { data: a, error } = await useBlogFetch<Article>('blog:' + slug, () => `/blog/articles/${encodeURIComponent(slug)}`)
if (error.value || !a.value) throw createError({ statusCode: 404, statusMessage: 'Article not found', fatal: true })
const origin = String(cfg.public.siteUrl).replace(/\/$/, '')
const url = `${origin}/${slug}`
const art = a.value
const img = (art.og ?? art.cover)?.variants.at(-1)
const ogImage = img ? `${origin}${mediaUrl(img)}` : undefined
const title = art.seoTitle || art.title
const desc = art.seoDescription || art.excerpt
useSeoMeta({ title: `${title} | ${cfg.public.appName}`, description: desc, ogTitle: title, ogDescription: desc, ogType: 'article', ogUrl: url, ogImage, twitterCard: 'summary_large_image', articlePublishedTime: art.publishedAt ?? undefined, articleModifiedTime: art.updatedAt })
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'Article', headline: art.title, description: desc, image: ogImage ? [ogImage] : undefined, datePublished: art.publishedAt, dateModified: art.updatedAt,
      author: { '@type': 'Person', name: art.author ?? cfg.public.appName }, mainEntityOfPage: url, publisher: { '@type': 'Organization', name: cfg.public.appName } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: origin }, { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/` }, { '@type': 'ListItem', position: 3, name: art.title, item: url }] },
  ]) }],
})
const enc = encodeURIComponent
const shares = [['X', `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(art.title)}`], ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
  ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`], ['WhatsApp', `https://wa.me/?text=${enc(art.title + ' ' + url)}`]]
const toast = useToast()
const tocOpen = ref(false)
async function copy(): Promise<void> { if (await copyText(url)) toast.ok('Link copied') }
</script>

<template>
  <article class="pt-4 md:pt-8 pb-10 grid lg:grid-cols-[minmax(0,72ch)_16rem] gap-8 justify-center">
    <div class="min-w-0">
      <nav class="text-sm text-muted mb-3" aria-label="Breadcrumb"><NuxtLink to="/" class="hover:underline">Blog</NuxtLink><template v-if="art.category"> / <NuxtLink :to="`/category/${art.category.slug}`" class="hover:underline">{{ art.category.name }}</NuxtLink></template></nav>
      <h1 class="text-3xl md:text-5xl font-bold tracking-tight leading-tight">{{ art.title }}</h1>
      <p class="text-sm text-muted mt-3"><span v-if="art.author">{{ art.author }} · </span><time :datetime="art.publishedAt ?? ''">{{ fmtDate(art.publishedAt) }}</time> · {{ art.readingMin }} min read</p>
      <BlogCover v-if="art.cover" :cover="art.cover" eager class="mt-6" />
      <details v-if="art.toc.length" class="lg:hidden card p-4 mt-6" :open="tocOpen" @toggle="tocOpen = ($event.target as HTMLDetailsElement).open"><summary class="font-semibold cursor-pointer">On this page</summary>
        <ul class="mt-2 space-y-1.5 text-sm"><li v-for="t in art.toc" :key="t.id" :class="t.level === 3 ? 'pl-4' : ''"><a :href="`#${t.id}`" class="text-accent-ink hover:underline" @click="tocOpen = false">{{ t.text }}</a></li></ul></details>
      <div class="prose-page prose-article mt-6 text-[1.05rem]" v-html="art.html" />
      <div v-if="art.tags.length" class="flex flex-wrap gap-2 mt-8"><NuxtLink v-for="t in art.tags" :key="t.slug" :to="`/tag/${t.slug}`" class="btn !min-h-8 text-sm">#{{ t.name }}</NuxtLink></div>
      <div class="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-line"><span class="text-sm text-muted mr-1">Share</span>
        <a v-for="s in shares" :key="s[0]" :href="s[1]" target="_blank" rel="noopener noreferrer" class="btn !min-h-9 text-sm">{{ s[0] }}</a><button class="btn !min-h-9 text-sm" @click="copy"><Icon name="copy" :size="14" />Copy link</button></div>
      <section v-if="art.related.length" class="mt-12"><h2 class="text-xl font-bold mb-4">Related articles</h2><div class="grid sm:grid-cols-3 gap-4"><BlogCard v-for="r in art.related" :key="r.slug" :post="r" /></div></section>
    </div>
    <aside class="hidden lg:block"><div class="sticky top-24 space-y-4">
      <nav v-if="art.toc.length" class="card p-4" aria-label="Table of contents"><p class="font-semibold mb-2 text-sm">On this page</p>
        <ul class="space-y-1.5 text-sm"><li v-for="t in art.toc" :key="t.id" :class="t.level === 3 ? 'pl-3' : ''"><a :href="`#${t.id}`" class="text-muted hover:text-accent-ink">{{ t.text }}</a></li></ul></nav>
    </div></aside>
  </article>
</template>
