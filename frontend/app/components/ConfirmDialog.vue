<script setup lang="ts">
const state = useConfirmState()
const yes = useTemplateRef<HTMLButtonElement>('yes')
const lock = useScrollLock(import.meta.client ? document.body : null)
watch(state, async s => { lock.value = !!s; if (s) { await nextTick(); yes.value?.focus() } })
function answer(v: boolean): void { state.value?.resolve(v); state.value = null }
</script>

<template>
  <Teleport to="body">
    <div v-if="state" class="fixed inset-0 z-[70] grid place-items-center p-4" role="alertdialog" aria-modal="true" :aria-label="state.title" @keydown.esc="answer(false)">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="answer(false)" />
      <div class="relative w-full max-w-sm bg-surface border border-line rounded-2xl shadow-card p-5 anim-pop">
        <div class="flex items-start gap-3">
          <span class="size-10 rounded-xl grid place-items-center shrink-0" :class="state.danger ? 'bg-pink-soft text-pink-ink' : 'bg-accent-soft text-accent-ink'"><Icon :name="state.danger ? 'trash' : 'alert'" :size="20" weight="bold" /></span>
          <div class="min-w-0"><h2 class="text-base font-semibold leading-snug">{{ state.title }}</h2><p class="text-sm text-muted mt-1 leading-relaxed">{{ state.text }}</p></div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn" @click="answer(false)">Cancel</button>
          <button ref="yes" class="btn" :class="state.danger ? 'btn-pink' : 'btn-accent'" data-testid="confirm-yes" @click="answer(true)">{{ state.confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
