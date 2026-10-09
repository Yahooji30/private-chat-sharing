<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api } from '../api'
import Icon from '../components/Icon.vue'
import Pager from '../components/Pager.vue'
import { confirmDialog, fail, fmtDate, ok } from '../ui'

interface Item { id: number; name: string; email: string; rating: number; message: string; status: 'new' | 'read' | 'archived'; public: boolean; at: number }
interface Result { items: Item[]; total: number; page: number; pageSize: number; average: number | null; unread: number }
const status = ref<'' | 'new' | 'read' | 'archived'>(''), page = ref(1)
const data = ref<Result | null>(null), loading = ref(true)
const tabs = [['', 'All'], ['new', 'New'], ['read', 'Read'], ['archived', 'Archived']] as const
const tone: Record<string, string> = { new: 'bg-accent-soft text-accent-ink', read: '', archived: 'opacity-60' }

async function load(): Promise<void> {
  loading.value = true
  try { data.value = await api<Result>(`/admin/feedback?page=${page.value}${status.value ? `&status=${status.value}` : ''}`) } catch (e) { fail(e) } finally { loading.value = false }
}
onMounted(load)
watch(status, () => { page.value = 1; void load() })

async function patch(i: Item, body: { status?: string; public?: boolean }, msg: string): Promise<void> {
  try { await api(`/admin/feedback/${i.id}`, { method: 'PATCH', body }); ok(msg); await load() } catch (e) { fail(e) }
}
async function del(i: Item): Promise<void> {
  if (!await confirmDialog('Delete feedback', 'This message will be removed permanently.')) return
  try { await api(`/admin/feedback/${i.id}`, { method: 'DELETE' }); ok('Deleted'); await load() } catch (e) { fail(e) }
}
const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n)
</script>

<template>
  <div class="space-y-4 max-w-4xl">
    <div class="flex items-center gap-3 flex-wrap"><h1 class="text-2xl font-bold mr-auto">Feedback</h1>
      <span v-if="data?.average" class="text-sm text-muted">Average <strong class="text-ink">{{ data.average.toFixed(1) }}</strong> / 5 · {{ data.total }} message{{ data.total === 1 ? '' : 's' }}</span></div>
    <p class="text-sm text-muted">Messages sent from the website's feedback form. Tick "Show on website" to feature one on the feedback page (only the name, rating and message are shown, never the email).</p>
    <div class="inline-flex rounded-xl bg-surface-2 p-1" role="tablist">
      <button v-for="t in tabs" :key="t[0]" role="tab" :aria-selected="status === t[0]" class="px-4 h-9 rounded-lg text-sm font-medium" :class="status === t[0] ? 'bg-surface shadow-sm' : 'text-muted'" @click="status = t[0]">
        {{ t[1] }}<span v-if="t[0] === 'new' && data?.unread" class="ml-1.5 badge !bg-accent !text-white">{{ data.unread }}</span></button>
    </div>

    <div class="space-y-3">
      <article v-for="i in data?.items" :key="i.id" class="card p-4 space-y-2" :data-feedback="i.id">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-warn text-lg leading-none tracking-wider" :aria-label="`${i.rating} out of 5`">{{ stars(i.rating) }}</span>
          <span class="font-medium">{{ i.name || 'Anonymous' }}</span>
          <a v-if="i.email" :href="`mailto:${i.email}`" class="text-sm text-accent-ink hover:underline">{{ i.email }}</a>
          <span class="badge" :class="tone[i.status]">{{ i.status }}</span><span v-if="i.public" class="badge bg-ok/20 text-ok">on website</span>
          <span class="ml-auto text-xs text-muted">{{ fmtDate(i.at) }}</span>
        </div>
        <p class="whitespace-pre-line break-words">{{ i.message }}</p>
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button v-if="i.status !== 'read'" class="btn !min-h-8" @click="patch(i, { status: 'read' }, 'Marked as read')"><Icon name="inbox" :size="15" />Mark read</button>
          <button v-if="i.status !== 'new'" class="btn !min-h-8" @click="patch(i, { status: 'new' }, 'Marked as new')">Mark new</button>
          <button v-if="i.status !== 'archived'" class="btn !min-h-8" @click="patch(i, { status: 'archived' }, 'Archived')">Archive</button>
          <label class="inline-flex items-center gap-2 text-sm font-medium ml-1"><input type="checkbox" class="size-4 accent-[var(--accent)]" :checked="i.public" @change="patch(i, { public: ($event.target as HTMLInputElement).checked }, i.public ? 'Hidden from the website' : 'Now shown on the website')">Show on website</label>
          <button class="btn btn-danger !min-h-8 ml-auto" :aria-label="`Delete feedback from ${i.name || 'Anonymous'}`" @click="del(i)"><Icon name="trash" :size="15" /></button>
        </div>
      </article>
      <p v-if="data && !data.items.length" class="card p-10 text-center text-muted">No feedback here yet.</p>
      <p v-else-if="!data && loading" class="text-muted">Loading...</p>
    </div>
    <Pager v-if="data" :page="data.page" :total="data.total" :size="data.pageSize" @go="p => { page = p; void load() }" />
  </div>
</template>
