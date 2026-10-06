<script setup lang="ts">
defineProps<{ page: number; total: number; size: number }>()
const emit = defineEmits<{ go: [number] }>()
</script>

<template>
  <div v-if="total > size" class="flex items-center justify-between pt-3 text-sm text-muted">
    <span>{{ (page - 1) * size + 1 }}-{{ Math.min(total, page * size) }} of {{ total }}</span>
    <div class="flex gap-2"><button class="btn" :disabled="page <= 1" @click="emit('go', page - 1)">Previous</button><button class="btn" :disabled="page * size >= total" @click="emit('go', page + 1)">Next</button></div>
  </div>
</template>
