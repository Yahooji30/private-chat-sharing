<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string; subtitle?: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = useTemplateRef<HTMLElement>('panel')
const lock = useScrollLock(import.meta.client ? document.body : null)
watch(() => props.open, async v => {
  lock.value = v
  if (v) { await nextTick(); panel.value?.focus() }
}, { immediate: true })
onBeforeUnmount(() => { lock.value = false })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end md:items-center justify-center" @keydown.esc="emit('close')">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="emit('close')" />
      <div ref="panel" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1"
        class="relative w-full md:max-w-[560px] max-h-[92dvh] md:max-h-[88dvh] flex flex-col bg-surface border border-line shadow-card outline-none rounded-t-3xl md:rounded-2xl anim-sheet">
        <div class="md:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" />
        <div class="px-5 pt-4 pb-2 flex items-start gap-3">
          <div class="min-w-0">
            <h2 class="text-xl font-semibold">{{ title }}</h2>
            <p v-if="subtitle" class="text-sm text-muted mt-1">{{ subtitle }}</p>
          </div>
          <button class="ml-auto -mr-2 size-10 grid place-items-center rounded-lg hover:bg-surface-2" aria-label="Close" @click="emit('close')"><Icon name="x" /></button>
        </div>
        <div class="px-5 pb-5 overflow-y-auto scroll-thin flex-1 min-h-0" :style="{ paddingBottom: 'calc(1.25rem + var(--safe-b))' }"><slot /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.anim-sheet { animation: sheet .22s cubic-bezier(.2, .8, .2, 1); }
@media (min-width: 768px) { .anim-sheet { animation: pop .18s ease-out; } }
</style>
