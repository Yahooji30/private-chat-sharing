<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../api'
import { fail } from '../ui'

interface Stats { onlineDevices: number; liveChatSockets: number; activeChatRooms: number; activeSpaces24h: number; chatRoomsTotal: number; publicPages: number; openReports: number; newFeedback: number; articles: Record<string, number> }
const s = ref<Stats | null>(null)
async function load(): Promise<void> { try { s.value = await api<Stats>('/admin/stats') } catch (e) { fail(e) } }
let t: ReturnType<typeof setInterval>
onMounted(() => { void load(); t = setInterval(load, 30_000) })
onBeforeUnmount(() => clearInterval(t))
const cards = (x: Stats): [string, number, string?][] => [
  ['Online devices', x.onlineDevices], ['Active spaces (24h)', x.activeSpaces24h], ['Chat rooms live', x.activeChatRooms], ['Chat rooms total', x.chatRoomsTotal],
  ['Published articles', x.articles.published ?? 0], ['Drafts', x.articles.draft ?? 0], ['Scheduled', x.articles.scheduled ?? 0], ['Public pages', x.publicPages], ['Open reports', x.openReports, x.openReports ? '/reports' : undefined], ['New feedback', x.newFeedback, x.newFeedback ? '/feedback' : undefined],
]
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Dashboard</h1>
    <p class="text-sm text-muted">Counts only. No user content is shown here. Refreshes every 30 seconds.</p>
    <div v-if="s" class="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <component :is="c[2] ? 'RouterLink' : 'div'" v-for="c in cards(s)" :key="c[0]" :to="c[2]" class="card p-4 block"><p class="text-sm text-muted">{{ c[0] }}</p><p class="text-3xl font-bold mt-1 tabular-nums" :class="(c[0] === 'Open reports' || c[0] === 'New feedback') && c[1] ? 'text-accent-ink' : ''">{{ c[1] }}</p></component>
    </div>
    <p v-else class="text-muted">Loading...</p>
  </div>
</template>
