<script setup lang="ts">
interface Faq { id: string; question: string; answerHtml: string; answerText: string; category: string }
const cfg = useRuntimeConfig()
const name = String(cfg.public.appName)
const appUrl = String(cfg.public.appUrl).replace(/\/$/, '')
const origin = String(cfg.public.siteUrl).replace(/\/$/, '')
const { data } = await useBlogFetch<{ items: Faq[] }>('faq', () => '/faq')
const items = computed(() => data.value?.items ?? [])

await usePageSeo('faq', {
  title: `FAQ | ${name}`,
  description: `Answers to common questions about ${name}: sharing text and files between devices, linking networks, secure chat rooms and privacy.`,
  path: '/faq',
  schema: [
    ...(items.value.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.value.map(i => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answerText } })) }] : []),
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: origin }, { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${origin}/faq` }] },
  ],
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
  <div class="max-w-3xl mx-auto pt-6 md:pt-10 pb-12">
    <h1 class="text-3xl md:text-4xl font-bold tracking-tight">Frequently asked questions</h1>
    <p class="text-muted mt-2 text-lg">Quick answers about {{ name }}. Can't find yours? <NuxtLink to="/feedback" class="text-accent-ink underline">Tell us</NuxtLink>.</p>

    <div v-if="items.length > 5" class="mt-5"><label class="sr-only" for="faq-search">Search the questions</label>
      <input id="faq-search" v-model="q" type="search" class="input" placeholder="Search the questions" autocomplete="off"></div>

    <section v-for="g in groups" :key="g[0]" class="mt-6" :aria-label="g[0] || 'Questions'">
      <h2 v-if="g[0]" class="text-sm font-semibold uppercase tracking-wide text-muted mb-2">{{ g[0] }}</h2>
      <div class="space-y-2">
        <details v-for="i in g[1]" :key="i.id" class="card group open:shadow-card">
          <summary class="flex items-center gap-3 cursor-pointer select-none px-4 py-3.5 font-semibold list-none [&::-webkit-details-marker]:hidden">
            <span class="flex-1">{{ i.question }}</span><Icon name="chevron" :size="18" class="text-muted transition group-open:rotate-180" />
          </summary>
          <div class="prose-page px-4 pb-4 -mt-1 text-[0.98rem]" v-html="i.answerHtml" />
        </details>
      </div>
    </section>

    <p v-if="items.length && !shown.length" class="card p-8 text-center text-muted mt-6">Nothing matches "{{ q }}".</p>
    <p v-else-if="!items.length" class="card p-10 text-center text-muted mt-6">Questions are on their way. In the meantime, ask us anything on the <NuxtLink to="/feedback" class="text-accent-ink underline">feedback page</NuxtLink>.</p>

    <div class="card p-5 mt-10 flex flex-wrap items-center gap-3">
      <div class="mr-auto"><p class="font-semibold">Still have a question?</p><p class="text-sm text-muted">We read every message.</p></div>
      <NuxtLink to="/feedback" class="btn">Send feedback</NuxtLink><a :href="appUrl" class="btn btn-accent">Open the app</a>
    </div>
  </div>
</template>
