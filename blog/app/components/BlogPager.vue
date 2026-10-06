<script setup lang="ts">
const props = defineProps<{ page: number; pages: number; base: string }>()
const to = (n: number): string => (n <= 1 ? props.base : `${props.base}?page=${n}`)
</script>

<template>
  <nav v-if="pages > 1" class="flex items-center justify-center gap-2 mt-8" aria-label="Pagination">
    <NuxtLink v-if="page > 1" :to="to(page - 1)" rel="prev" class="btn">Newer</NuxtLink>
    <span class="text-sm text-muted px-2">Page {{ page }} of {{ pages }}</span>
    <NuxtLink v-if="page < pages" :to="to(page + 1)" rel="next" class="btn">Older</NuxtLink>
  </nav>
</template>
