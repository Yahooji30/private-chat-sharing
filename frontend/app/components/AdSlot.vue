<script setup lang="ts">
const props = defineProps<{ slot: 'top-banner' | 'sidebar' | 'in-article' | 'footer'; height?: number }>()
const route = useRoute()
const ads = useState<{ enabled: boolean; slots: Record<string, string> } | null>('ads', () => null)
const show = computed(() => !route.path.startsWith('/c/') && ads.value?.enabled && ads.value.slots[props.slot])
onMounted(async () => { if (!ads.value) ads.value = await api<{ enabled: boolean; slots: Record<string, string> }>('/ads').catch(() => ({ enabled: false, slots: {} })) })
</script>

<template>
  <!-- ad html is admin-authored and trusted; the reserved height avoids layout shift -->
  <aside v-if="show" class="my-4 mx-auto text-center overflow-hidden" :style="{ minHeight: `${height ?? 90}px` }" aria-label="Advertisement" v-html="ads?.slots[slot]" />
</template>
