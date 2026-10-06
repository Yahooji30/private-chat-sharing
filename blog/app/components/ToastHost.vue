<script setup lang="ts">
const { toasts } = useToast()
const tone = { ok: 'border-ok/50', warn: 'border-warn bg-warn/15', err: 'border-accent/60 bg-accent-soft' }
const icon = { ok: 'checkCircle', warn: 'alert', err: 'alert' }
</script>

<template>
  <div class="fixed z-[70] top-16 right-3 left-3 md:left-auto md:w-96 flex flex-col gap-2 pointer-events-none" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="anim-pop pointer-events-auto card shadow-card px-4 py-3 text-sm flex items-start gap-2.5" :class="tone[t.kind]">
      <Icon :name="icon[t.kind]" :size="18" class="mt-0.5" :class="t.kind === 'ok' ? 'text-ok' : 'text-accent-ink'" />
      <span>{{ t.text }}</span>
    </div>
  </div>
</template>
