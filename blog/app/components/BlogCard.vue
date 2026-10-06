<script setup lang="ts">
import type { Card } from '~/composables/useBlog'
defineProps<{ post: Card; big?: boolean }>()
</script>

<template>
  <article class="group card overflow-hidden flex flex-col h-full transition hover:shadow-card" :class="big ? 'md:flex-row' : ''">
    <NuxtLink :to="`/${post.slug}`" class="block shrink-0" :class="big ? 'md:w-1/2' : ''" :aria-label="post.title" tabindex="-1">
      <BlogCover v-if="post.cover" :cover="post.cover" :eager="big" sizes="(min-width: 768px) 400px, 100vw" class="!rounded-none" />
      <div v-else class="aspect-[16/9] bg-accent-soft grid place-items-center text-accent-ink"><Icon name="file" :size="36" /></div>
    </NuxtLink>
    <div class="p-4 md:p-5 flex flex-col gap-2 flex-1">
      <p class="text-xs text-muted flex gap-2 items-center"><NuxtLink v-if="post.category" :to="`/category/${post.category.slug}`" class="text-accent-ink font-medium hover:underline">{{ post.category.name }}</NuxtLink><span>{{ fmtDate(post.publishedAt) }}</span><span>{{ post.readingMin }} min read</span></p>
      <h2 class="font-bold leading-snug" :class="big ? 'text-2xl md:text-3xl' : 'text-lg'"><NuxtLink :to="`/${post.slug}`" class="hover:text-accent-ink">{{ post.title }}</NuxtLink></h2>
      <p class="text-muted text-sm leading-relaxed line-clamp-3">{{ post.excerpt }}</p>
    </div>
  </article>
</template>
