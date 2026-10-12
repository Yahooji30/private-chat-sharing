<script setup lang="ts">
interface Faq { id: string; question: string; answerHtml: string; answerText: string; category: string }
const name = String(useRuntimeConfig().public.appName)
const blogUrl = useApp().blogUrl
useAppSeo('faq', { title: `FAQ | ${name}`, description: `Answers to common questions about ${name}: sharing text and files between devices, linking networks, secure chat rooms and privacy.` })
// the server-rendered copy on the blog site is the one search engines index
useHead({ link: blogUrl ? [{ rel: 'canonical', href: `${blogUrl}/faq` }] : [] })

const items = ref<Faq[]>([])
const loading = ref(true)
onMounted(async () => {
  try { items.value = (await api<{ items: Faq[] }>('/faq')).items } catch { /* the empty state explains */ }
  loading.value = false
})
const q = ref('')
const shown = computed(() => {
  const t = q.value.trim().toLowerCase()
  return t ? items.value.filter(i => `${i.question} ${i.answerText}`.toLowerCase().includes(t)) : items.value
})
const groups = computed(() => {
  const m = new Map<string, Faq[]>()
  for (const i of shown.value) m.set(i.category, [...(m.get(i.category) ?? []), i])
  return [...m.entries()]
})
</script>

<template>
  <div class="max-w-3xl mx-auto pt-3 lg:pt-1 pb-8">
    <p class="eyebrow">FAQ</p>
    <h1 class="text-3xl md:text-4xl font-semibold mt-1">Frequently asked questions</h1>
    <p class="text-muted mt-2 text-base md:text-lg">Quick answers about {{ name }}.</p>

    <div v-if="items.length > 5" class="mt-5"><label class="sr-only" for="faq-search">Search the questions</label>
      <input id="faq-search" v-model="q" type="search" class="input" placeholder="Search the questions" autocomplete="off"></div>

    <p v-if="loading" class="text-muted mt-8 flex items-center gap-2"><Icon name="refresh" class="animate-spin" />Loading...</p>
    <section v-for="g in groups" :key="g[0]" class="mt-6" :aria-label="g[0] || 'Questions'">
      <h2 v-if="g[0]" class="eyebrow mb-2">{{ g[0] }}</h2>
      <div class="space-y-2">
        <details v-for="i in g[1]" :key="i.id" class="card group">
          <summary class="flex items-center gap-3 cursor-pointer select-none px-4 py-3.5 font-medium list-none [&::-webkit-details-marker]:hidden">
            <span class="flex-1">{{ i.question }}</span><Icon name="chevron" :size="18" class="text-muted transition group-open:rotate-180" />
          </summary>
          <div class="prose-page px-4 pb-4 -mt-1 text-[0.95rem]" v-html="i.answerHtml" />
        </details>
      </div>
    </section>

    <p v-if="!loading && items.length && !shown.length" class="card p-8 text-center text-muted mt-6">Nothing matches "{{ q }}".</p>
    <p v-else-if="!loading && !items.length" class="card p-10 text-center text-muted mt-6">Questions are on their way.</p>

    <div class="card p-5 mt-10 flex flex-wrap items-center gap-3">
      <div class="mr-auto"><p class="font-semibold">Still have a question?</p><p class="text-sm text-muted">We read every message.</p></div>
      <NuxtLink to="/feedback" class="btn">Send feedback</NuxtLink><NuxtLink to="/" class="btn btn-accent">Open the app</NuxtLink>
    </div>
    <AdSlot kind="inline" class="mt-8" />
  </div>
</template>
