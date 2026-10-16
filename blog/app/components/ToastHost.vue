<script setup lang="ts">
const { toasts, dismiss } = useToast()
// solid backgrounds (never see-through), a coloured edge and icon say what kind of message it is
const edge = { ok: 'border-l-ok', warn: 'border-l-warn', err: 'border-l-pink' }
const tint = { ok: 'text-ok', warn: 'text-[#B7791F] dark:text-warn', err: 'text-pink-ink' }
const icon = { ok: 'checkCircle', warn: 'alert', err: 'alert' }
</script>

<template>
  <!-- phones: top centre, under the status bar; computers: top right. Above every pop-up and sheet. -->
  <div class="fixed z-[100] inset-x-0 top-0 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] px-3 md:inset-x-auto md:right-4 md:top-4 md:pt-0 md:px-0 md:w-[24rem] flex flex-col items-center md:items-stretch gap-2 pointer-events-none" data-testid="toasts">
    <div v-for="t in toasts" :key="t.id" :role="t.kind === 'err' ? 'alert' : 'status'" :aria-live="t.kind === 'err' ? 'assertive' : 'polite'"
      class="anim-pop pointer-events-auto w-full max-w-md md:max-w-none cursor-pointer rounded-xl border border-line border-l-4 bg-surface text-ink shadow-[0_10px_30px_-8px_rgba(15,20,36,0.35)] px-4 py-3 text-sm font-medium flex items-start gap-2.5"
      :class="edge[t.kind]" @click="dismiss(t.id)">
      <Icon :name="icon[t.kind]" :size="20" class="mt-px shrink-0" :class="tint[t.kind]" />
      <span class="min-w-0 break-words leading-snug">{{ t.text }}</span>
    </div>
  </div>
</template>
