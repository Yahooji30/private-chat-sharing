<script setup lang="ts">
/** Feedback as a pop-up from anywhere in the app (footer, FAQ, features). Posts to the same endpoint as the blog's feedback page. */
const open = useState('feedback-open', () => false)
const name = String(useRuntimeConfig().public.appName)
const toast = useToast()
const rating = ref(0)
const who = ref(''), email = ref(''), message = ref(''), website = ref('')
const state = ref<'idle' | 'sending' | 'done'>('idle')
const error = ref('')
const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']
watch(open, v => { if (v && state.value === 'done') state.value = 'idle' })

async function submit(): Promise<void> {
  error.value = ''
  if (!rating.value) { error.value = 'Please choose a star rating.'; return }
  if (message.value.trim().length < 5) { error.value = 'Please write a few words (at least 5 characters).'; return }
  state.value = 'sending'
  try {
    await api('/feedback', { method: 'POST', body: { rating: rating.value, name: who.value, email: email.value, message: message.value, website: website.value } })
    state.value = 'done'
    rating.value = 0; who.value = ''; email.value = ''; message.value = ''
  } catch (e) {
    state.value = 'idle'
    error.value = (e as ApiFailure).status === 429 ? 'You have sent a few messages already. Please try again later.' : (e as Error).message
    toast.err(error.value)
  }
}
</script>

<template>
  <Modal :open="open" title="Send feedback" :subtitle="`Found a bug, want a feature, or enjoying ${name}? We read every message.`" @close="open = false">
    <div v-if="state === 'done'" class="text-center py-6 space-y-3" role="status">
      <span class="size-14 mx-auto rounded-xl bg-accent-soft text-accent-ink grid place-items-center"><Icon name="check" :size="28" weight="bold" /></span>
      <h3 class="text-lg font-semibold">Thank you!</h3><p class="text-muted text-sm">Your feedback was sent.</p>
      <button class="btn btn-accent" @click="open = false">Close</button>
    </div>
    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <fieldset>
        <legend class="text-sm font-medium">Your rating</legend>
        <div class="flex items-center gap-0.5 mt-1" role="radiogroup" aria-label="Rating">
          <label v-for="n in 5" :key="n" class="cursor-pointer p-1 rounded-lg focus-within:outline-2 focus-within:outline-accent" :class="n <= rating ? 'text-warn' : 'text-line'">
            <input v-model.number="rating" type="radio" name="rating" :value="n" class="sr-only" :aria-label="`${n} star${n > 1 ? 's' : ''}, ${labels[n]}`"><Icon name="star" :size="32" :weight="n <= rating ? 'fill' : 'regular'" />
          </label>
          <span class="ml-2 text-sm text-muted" aria-live="polite">{{ labels[rating] }}</span>
        </div>
      </fieldset>
      <label class="block"><span class="text-sm font-medium">Your message</span>
        <textarea v-model="message" class="input mt-1.5 !py-2.5 min-h-28" rows="4" maxlength="2000" required placeholder="What's on your mind?" /></label>
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="block"><span class="text-sm font-medium">Name <span class="text-muted font-normal">(optional)</span></span><input v-model="who" class="input mt-1.5" maxlength="60" autocomplete="name"></label>
        <label class="block"><span class="text-sm font-medium">Email <span class="text-muted font-normal">(optional)</span></span><input v-model="email" type="email" class="input mt-1.5" maxlength="120" autocomplete="email"></label>
      </div>
      <div class="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true"><label>Website<input v-model="website" tabindex="-1" autocomplete="off" name="website"></label></div>
      <p v-if="error" class="text-sm text-pink-ink" role="alert">{{ error }}</p>
      <button class="btn btn-accent w-full !min-h-11" :disabled="state === 'sending'">{{ state === 'sending' ? 'Sending...' : 'Send feedback' }}</button>
      <p class="text-xs text-muted">Your email is only used to reply and is never shown publicly.</p>
    </form>
  </Modal>
</template>
