<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { confirmDialog, fail, fmtDate, ok } from '../ui'

interface R { id: number; slug: string; title: string; pageStatus: string; reason: string; at: number; resolved: boolean }
const rows = ref<R[]>([])
const load = async (): Promise<void> => { try { rows.value = await api<R[]>('/admin/reports') } catch (e) { fail(e) } }
onMounted(load)
async function run(label: string, fn: () => Promise<unknown>): Promise<void> { try { await fn(); ok(label); await load() } catch (e) { fail(e) } }
const resolve = (r: R): Promise<void> => run('Resolved', () => api(`/admin/reports/${r.id}/resolve`, { method: 'POST' }))
async function unpublish(r: R): Promise<void> { if (await confirmDialog('Unpublish page', `/p/${r.slug} will stop being public.`)) await run('Unpublished', () => api(`/admin/public-pages/${r.slug}/unpublish`, { method: 'POST' })) }
async function remove(r: R): Promise<void> { if (await confirmDialog('Delete page', `/p/${r.slug} will be deleted permanently.`)) await run('Deleted', () => api(`/admin/public-pages/${r.slug}`, { method: 'DELETE' })) }
</script>

<template>
  <div class="space-y-4"><h1 class="text-2xl font-bold">Reports</h1><p class="text-sm text-muted">Public pages reported by visitors.</p>
    <div class="card overflow-x-auto"><table class="w-full text-sm min-w-[640px]"><thead><tr><th class="th">Page</th><th class="th">Reason</th><th class="th">Reported</th><th class="th">State</th><th class="th" /></tr></thead><tbody>
      <tr v-for="r in rows" :key="r.id"><td class="td"><a :href="`/p/${r.slug}`" target="_blank" rel="noopener" class="font-medium hover:text-accent-ink">{{ r.title }}</a><p class="text-xs text-muted">/p/{{ r.slug }}</p></td>
        <td class="td max-w-xs">{{ r.reason }}</td><td class="td">{{ fmtDate(r.at) }}</td><td class="td"><span class="badge">{{ r.resolved ? 'resolved' : 'open' }}</span> <span v-if="r.pageStatus !== 'published'" class="badge">{{ r.pageStatus }}</span></td>
        <td class="td text-right whitespace-nowrap"><button v-if="!r.resolved" class="btn mr-1" @click="resolve(r)">Resolve</button><button v-if="r.pageStatus === 'published'" class="btn mr-1" @click="unpublish(r)">Unpublish</button><button class="btn btn-danger" @click="remove(r)">Delete page</button></td></tr>
      <tr v-if="!rows.length"><td colspan="5" class="td text-center text-muted py-10">No reports.</td></tr></tbody></table></div></div>
</template>
