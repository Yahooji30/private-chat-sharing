<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api } from '../api'
import { confirmDialog, fail, ok } from '../ui'

const props = defineProps<{ kind: 'categories' | 'tags' }>()
interface Row { id: string; slug: string; name: string; description?: string; count: number }
const rows = ref<Row[]>([]), name = ref(''), edit = ref<Row | null>(null)
const label = (): string => (props.kind === 'categories' ? 'Category' : 'Tag')
async function load(): Promise<void> { try { rows.value = await api<Row[]>(`/admin/${props.kind}`) } catch (e) { fail(e) } }
onMounted(load); watch(() => props.kind, load)
async function add(): Promise<void> { if (!name.value.trim()) return; try { await api(`/admin/${props.kind}`, { method: 'POST', body: { name: name.value } }); name.value = ''; ok('Added'); await load() } catch (e) { fail(e) } }
async function save(): Promise<void> {
  if (!edit.value) return
  try { await api(`/admin/${props.kind}/${edit.value.id}`, { method: 'PUT', body: { name: edit.value.name, slug: edit.value.slug, ...(props.kind === 'categories' ? { description: edit.value.description ?? '' } : {}) } }); edit.value = null; ok('Saved'); await load() } catch (e) { fail(e) }
}
async function del(r: Row): Promise<void> {
  if (!await confirmDialog(`Delete ${label().toLowerCase()}`, `"${r.name}" will be removed from ${r.count} article(s).`)) return
  try { await api(`/admin/${props.kind}/${r.id}`, { method: 'DELETE' }); ok('Deleted'); await load() } catch (e) { fail(e) }
}
</script>

<template>
  <div class="space-y-4 max-w-3xl">
    <h1 class="text-2xl font-bold">{{ props.kind === 'categories' ? 'Categories' : 'Tags' }}</h1>
    <form class="flex gap-2" @submit.prevent="add"><input v-model="name" class="input" :placeholder="`New ${label().toLowerCase()} name`" :aria-label="`New ${label().toLowerCase()}`" maxlength="60"><button class="btn btn-accent">Add</button></form>
    <div class="card overflow-x-auto"><table class="w-full text-sm min-w-[480px]"><thead><tr><th class="th">Name</th><th class="th">Slug</th><th class="th">Articles</th><th class="th" /></tr></thead><tbody>
      <tr v-for="r in rows" :key="r.id">
        <template v-if="edit?.id === r.id"><td class="td"><input v-model="edit.name" class="input" aria-label="Name"></td><td class="td"><input v-model="edit.slug" class="input" aria-label="Slug"></td><td class="td">{{ r.count }}</td>
          <td class="td text-right whitespace-nowrap"><button class="btn btn-accent mr-1" @click="save">Save</button><button class="btn" @click="edit = null">Cancel</button></td></template>
        <template v-else><td class="td font-medium">{{ r.name }}</td><td class="td text-muted">{{ r.slug }}</td><td class="td">{{ r.count }}</td>
          <td class="td text-right whitespace-nowrap"><button class="btn mr-1" @click="edit = { ...r }">Edit</button><button class="btn btn-danger" :aria-label="`Delete ${r.name}`" @click="del(r)">Delete</button></td></template>
      </tr>
      <tr v-if="!rows.length"><td colspan="4" class="td text-center text-muted py-8">Nothing yet.</td></tr></tbody></table></div>
  </div>
</template>
