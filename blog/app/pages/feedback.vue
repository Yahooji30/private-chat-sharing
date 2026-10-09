<script setup lang="ts">
interface Shared { name: string; rating: number; message: string; at: string }
const cfg = useRuntimeConfig()
const name = String(cfg.public.appName)
const origin = String(cfg.public.siteUrl).replace(/\/$/, '')
const { data } = await useBlogFetch<{ items: Shared[] }>('feedback:public', () => '/feedback/public')

await usePageSeo('feedback', {
  title: `Feedback | ${name}`,
  description: `Tell us what you think of ${name}. Report a problem, suggest a feature or just say hello. We read every message.`,
  path: '/feedback',
  schema: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: origin }, { '@type': 'ListItem', position: 2, name: 'Feedback', item: `${origin}/feedback` }] }],
})

const toast = useToast()
const rating = ref(0), hover = ref(0)
const who = ref(''), email = ref(''), message = ref(''), website = ref('')
const state = ref<'idle' | 'sending' | 'done'>('idle')
const error = ref('')
const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n)
const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

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
  <div class="max-w-2xl mx-auto pt-6 md:pt-10 pb-12">
    <h1 class="text-3xl md:text-4xl font-bold tracking-tight">Feedback</h1>
    <p class="text-muted mt-2 text-lg">Found a bug, want a feature, or enjoying {{ name }}? Tell us. We read every message.</p>

    <div v-if="state === 'done'" class="card p-8 mt-6 text-center space-y-3" role="status">
      <span class="size-14 mx-auto rounded-2xl bg-accent-soft text-accent-ink grid place-items-center"><Icon name="check" :size="28" /></span>
      <h2 class="text-xl font-semibold">Thank you!</h2><p class="text-muted">Your feedback was sent.</p>
      <button class="btn" @click="state = 'idle'">Send another</button>
    </div>

    <form v-else class="card p-5 md:p-6 mt-6 space-y-4" novalidate @submit.prevent="submit">
      <fieldset>
        <legend class="text-sm font-medium">Your rating</legend>
        <div class="flex items-center gap-1 mt-1.5" role="radiogroup" aria-label="Rating">
          <label v-for="n in 5" :key="n" class="cursor-pointer text-4xl leading-none px-0.5 rounded focus-within:outline-2 focus-within:outline-accent transition" :class="n <= (hover || rating) ? 'text-warn' : 'text-muted/40'" @mouseenter="hover = n" @mouseleave="hover = 0">
            <input v-model.number="rating" type="radio" name="rating" :value="n" class="sr-only" :aria-label="`${n} star${n > 1 ? 's' : ''}, ${labels[n]}`">★
          </label>
          <span class="ml-2 text-sm text-muted" aria-live="polite">{{ labels[hover || rating] }}</span>
        </div>
      </fieldset>
      <label class="block"><span class="text-sm font-medium">Your message</span>
        <textarea v-model="message" class="input mt-1.5 !py-2.5 min-h-32" rows="5" maxlength="2000" required placeholder="What's on your mind?" /></label>
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="block"><span class="text-sm font-medium">Name <span class="text-muted font-normal">(optional)</span></span><input v-model="who" class="input mt-1.5" maxlength="60" autocomplete="name"></label>
        <label class="block"><span class="text-sm font-medium">Email <span class="text-muted font-normal">(optional, if you'd like a reply)</span></span><input v-model="email" type="email" class="input mt-1.5" maxlength="120" autocomplete="email"></label>
      </div>
      <!-- honeypot: invisible to people, tempting to bots -->
      <div class="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true"><label>Website<input v-model="website" tabindex="-1" autocomplete="off" name="website"></label></div>
      <p v-if="error" class="text-sm text-accent-ink" role="alert">{{ error }}</p>
      <button class="btn btn-accent w-full !min-h-12 text-base" :disabled="state === 'sending'">{{ state === 'sending' ? 'Sending...' : 'Send feedback' }}</button>
      <p class="text-xs text-muted">Your email is only used to reply and is never shown publicly.</p>
    </form>

    <section v-if="data?.items.length" class="mt-12" aria-labelledby="loved">
      <h2 id="loved" class="text-xl font-bold tracking-tight">What people say</h2>
      <ul class="grid sm:grid-cols-2 gap-4 mt-4">
        <li v-for="(i, n) in data.items" :key="n" class="card p-5"><p class="text-warn tracking-wider" :aria-label="`${i.rating} out of 5`">{{ stars(i.rating) }}</p><p class="mt-2 whitespace-pre-line break-words">{{ i.message }}</p><p class="text-sm text-muted mt-3">{{ i.name }}</p></li>
      </ul>
    </section>
  </div>
</template>
