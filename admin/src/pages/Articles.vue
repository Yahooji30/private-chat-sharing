<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { api } from '../api'
import Pager from '../components/Pager.vue'
import { confirmDialog, fail, fmtDate, ok } from '../ui'

interface Row { id: string; slug: string; title: string; status: string; category: string | null; author: string | null; publishAt: number | null; publishedAt: number | null; updatedAt: number }
const router = useRouter()
const f = reactive({ status: '', category: '', q: '', page: 1 })
const rows = ref<Row[]>([]), total = ref(0), cats = ref<{ id: string; name: string }[]>([]), loading = ref(true)
const tone: Record<string, string> = { published: 'bg-ok/20 text-ok', draft: '', scheduled: 'bg-warn/20 text-warn', archived: 'opacity-60' }

async function load(): Promise<void> {
  loading.value = true
  try {
    const qs = new URLSearchParams({ page: String(f.page), ...(f.status ? { status: f.status } : {}), ...(f.category ? { category: f.category } : {}), ...(f.q ? { q: f.q } : {}) })
    const r = await api<{ items: Row[]; total: number }>(`/admin/articles?${qs}`)
    rows.value = r.items; total.value = r.total
  } catch (e) { fail(e) } finally { loading.value = false }
}
let t: ReturnType<typeof setTimeout>
watch(() => [f.status, f.category], () => { f.page = 1; void load() })
watch(() => f.q, () => { clearTimeout(t); t = setTimeout(() => { f.page = 1; void load() }, 300) })
onMounted(async () => { cats.value = await api<{ id: string; name: string }[]>('/admin/categories').catch(() => []); await load() })
async function del(r: Row): Promise<void> {
  if (!await confirmDialog('Delete article', `"${r.title}" will be removed permanently.`)) return
  try { await api(`/admin/articles/${r.id}`, { method: 'DELETE' }); ok('Deleted'); await load() } catch (e) { fail(e) }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3"><h1 class="text-2xl font-bold mr-auto">Articles</h1><button class="btn btn-accent" data-testid="new-article" @click="router.push('/articles/new')">New article</button></div>
    <div class="grid sm:grid-cols-3 gap-2">
      <input v-model="f.q" class="input" placeholder="Search title" aria-label="Search">
      <select v-model="f.status" class="input" aria-label="Status"><option value="">All statuses</option><option>draft</option><option>scheduled</option><option>published</option><option>archived</option></select>
      <select v-model="f.category" class="input" aria-label="Category"><option value="">All categories</option><option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option></select>
    </div>
    <div class="card overflow-x-auto">
      <table class="w-full text-sm min-w-[640px]"><thead><tr><th class="th">Title</th><th class="th">Status</th><th class="th">Category</th><th class="th">Date</th><th class="th">Updated</th><th class="th" /></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" :data-title="r.title">
            <td class="td"><RouterLink :to="`/articles/${r.id}`" class="font-medium hover:text-accent-ink">{{ r.title }}</RouterLink></td>
            <td class="td"><span class="badge" :class="tone[r.status]">{{ r.status }}</span></td><td class="td">{{ r.category ?? '-' }}</td>
            <td class="td">{{ fmtDate(r.status === 'scheduled' ? r.publishAt : r.publishedAt) }}</td><td class="td">{{ fmtDate(r.updatedAt) }}</td>
            <td class="td text-right"><button class="btn btn-danger !min-h-8" :aria-label="`Delete ${r.title}`" @click="del(r)">Delete</button></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="td text-center text-muted py-10">{{ loading ? 'Loading...' : 'No articles found.' }}</td></tr>
        </tbody></table>
    </div>
    <Pager :page="f.page" :total="total" :size="25" @go="p => { f.page = p; void load() }" />
  </div>
</template>
