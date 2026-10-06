<script setup lang="ts">
defineProps<{ title: string; desc?: string; sub?: boolean }>()
</script>

<template>
  <div class="flex items-center gap-4 justify-between" :class="sub ? 'pl-3 ml-1 border-l border-line' : ''">
    <div class="min-w-0">
      <p class="font-medium" :class="sub ? 'text-[0.95rem]' : ''">{{ title }}</p>
      <p v-if="desc" class="text-sm text-muted mt-0.5">{{ desc }}</p>
    </div>
    <slot />
  </div>
</template>
