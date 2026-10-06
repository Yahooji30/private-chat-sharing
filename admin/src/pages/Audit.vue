<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import Pager from '../components/Pager.vue'
import { fail, fmtDate } from '../ui'

interface L { id: string; admin: string; action: string; target: string; at: number }
const rows = ref<L[]>([]), total = ref(0), page = ref(1)
async function load(): Promise<void> { try { const r = await api<{ items: L[]; total: number }>(`/admin/audit?page=${page.value}`); rows.value = r.items; total.value = r.total } catch (e) { fail(e) } }
onMounted(load)
</script>

<template>
  <div class="space-y-4"><h1 class="text-2xl font-bold">Audit log</h1>
    <div class="card overflow-x-auto"><table class="w-full text-sm min-w-[520px]"><thead><tr><th class="th">When</th><th class="th">Admin</th><th class="th">Action</th><th class="th">Target</th></tr></thead><tbody>
      <tr v-for="l in rows" :key="l.id"><td class="td whitespace-nowrap">{{ fmtDate(l.at) }}</td><td class="td">{{ l.admin }}</td><td class="td"><span class="badge">{{ l.action }}</span></td><td class="td text-muted break-all">{{ l.target }}</td></tr>
      <tr v-if="!rows.length"><td colspan="4" class="td text-center text-muted py-10">No activity yet.</td></tr></tbody></table></div>
    <Pager :page="page" :total="total" :size="50" @go="p => { page = p; void load() }" />
  </div>
</template>
