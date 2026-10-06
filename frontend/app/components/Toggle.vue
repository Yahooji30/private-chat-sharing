<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <button type="button" role="switch" :aria-checked="modelValue" :aria-label="label" class="relative h-7 w-12 shrink-0 rounded-full transition-colors"
    :class="modelValue ? 'bg-accent' : 'bg-line'" @click="emit('update:modelValue', !modelValue)">
    <span class="absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform" :class="modelValue ? 'translate-x-5' : ''" />
  </button>
</template>
