<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '../api'
import { fail } from '../ui'

interface Stats {
  onlineDevices: number; liveChatSockets: number; activeChatRooms: number; activeSpaces24h: number; newSpaces24h: number; spacesTotal: number
  chatRoomsTotal: number; faqPublished: number; openReports: number; newFeedback: number; articles: Record<string, number>
}
const s = ref<Stats | null>(null)
const at = ref<Date | null>(null)
const busy = ref(false)
async function load(): Promise<void> {
  busy.value = true
  try { s.value = await api<Stats>('/admin/stats'); at.value = new Date() } catch (e) { fail(e) } finally { busy.value = false }
}
let t: ReturnType<typeof setInterval>
onMounted(() => { void load(); t = setInterval(load, 30_000) })
onBeforeUnmount(() => clearInterval(t))

interface Card { label: string; value: number; help: string; to?: string; link?: string }
interface Group { title: string; intro: string; cards: Card[] }
const groups = computed<Group[]>(() => {
  const x = s.value
  if (!x) return []
  return [
    { title: 'Right now', intro: 'Who is using the website at this moment.', cards: [
      { label: 'People online', value: x.onlineDevices, help: 'Phones and computers that have the website open right now. One person with two devices counts twice.' },
      { label: 'Secure chat rooms open', value: x.activeChatRooms, help: 'Private chat rooms with at least one person inside. A room disappears when everyone has left.' },
    ] },
    { title: 'Last 24 hours', intro: 'How much the website was used today. Only counts, no one’s text, files or messages are ever shown here.', cards: [
      { label: 'Groups that used it', value: x.activeSpaces24h, help: 'A “group” (called a space) is a set of devices that share one scratchpad and one file list: everyone on the same Wi-Fi or network, plus any device they linked. So this is roughly how many separate households, offices or friends used the website in the last day.' },
      { label: 'New groups today', value: x.newSpaces24h, help: 'Groups that were seen for the first time in the last 24 hours, so new visitors.' },
    ] },
    { title: 'Totals since the start', intro: 'Everything counted from day one.', cards: [
      { label: 'Groups ever created', value: x.spacesTotal, help: 'All the groups (spaces) that ever opened the website, active or not.' },
      { label: 'Secure chat rooms ever created', value: x.chatRoomsTotal, help: 'All the private chat rooms that were ever made.' },
    ] },
    { title: 'Your blog', intro: 'Articles you write in Articles.', cards: [
      { label: 'Published', value: x.articles.published ?? 0, help: 'Live on the blog and in Google.', to: '/articles', link: 'Open articles' },
      { label: 'Drafts', value: x.articles.draft ?? 0, help: 'Saved but not visible to anyone yet.', to: '/articles' },
      { label: 'Scheduled', value: x.articles.scheduled ?? 0, help: 'Will go live by themselves at the date you chose.', to: '/articles' },
      { label: 'FAQ questions live', value: x.faqPublished, help: 'Questions and answers shown on the FAQ page.', to: '/faqs', link: 'Edit FAQ' },
    ] },
  ]
})
const attention = computed(() => {
  const x = s.value
  if (!x) return []
  return [
    ...(x.newFeedback ? [{ text: `${x.newFeedback} new feedback message${x.newFeedback === 1 ? '' : 's'} from visitors`, to: '/feedback', cta: 'Read feedback' }] : []),
    ...(x.openReports ? [{ text: `${x.openReports} report${x.openReports === 1 ? '' : 's'} waiting to be looked at`, to: '/reports', cta: 'Open reports' }] : []),
  ]
})
const time = computed(() => at.value?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '')
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div class="flex flex-wrap items-end gap-3">
      <div><h1 class="text-2xl font-semibold">Dashboard</h1>
        <p class="text-sm text-muted mt-1">A quick look at how your website is doing. These are only numbers: nobody’s text, files or chat messages are ever shown.</p></div>
      <div class="ml-auto flex items-center gap-2 text-xs text-muted"><span v-if="time">Updated {{ time }} (refreshes by itself)</span>
        <button class="btn" :disabled="busy" aria-label="Refresh now" @click="load">Refresh</button></div>
    </div>

    <template v-if="s">
      <section class="card p-4" :class="attention.length ? 'border-accent/60' : ''" aria-label="Needs your attention">
        <h2 class="font-semibold">Needs your attention</h2>
        <ul v-if="attention.length" class="mt-2 space-y-2">
          <li v-for="a in attention" :key="a.to" class="flex flex-wrap items-center gap-3 text-sm"><span class="size-2 rounded-full bg-accent shrink-0" /><span>{{ a.text }}</span>
            <RouterLink :to="a.to" class="btn btn-accent ml-auto">{{ a.cta }}</RouterLink></li>
        </ul>
        <p v-else class="text-sm text-muted mt-1">Nothing waiting. No new feedback and no reports.</p>
      </section>

      <section v-for="g in groups" :key="g.title" :aria-label="g.title">
        <h2 class="font-semibold">{{ g.title }}</h2>
        <p class="text-sm text-muted mb-2">{{ g.intro }}</p>
        <div class="grid sm:grid-cols-2 gap-3">
          <component :is="c.to ? RouterLink : 'div'" v-for="c in g.cards" :key="c.label" :to="c.to" class="card p-4 block" :class="c.to ? 'hover:border-accent/60' : ''">
            <p class="text-sm font-medium">{{ c.label }}</p>
            <p class="text-3xl font-semibold mt-1 tabular-nums">{{ c.value.toLocaleString() }}</p>
            <p class="text-xs text-muted mt-2 leading-relaxed">{{ c.help }}</p>
            <p v-if="c.link" class="text-xs text-accent-ink font-medium mt-2">{{ c.link }} →</p>
          </component>
        </div>
      </section>
    </template>
    <p v-else class="text-muted">Loading...</p>
  </div>
</template>
