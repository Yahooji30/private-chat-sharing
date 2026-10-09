<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { api } from '../api'
import Icon from '../components/Icon.vue'
import { confirmDialog, fail, ok } from '../ui'

interface Faq { id: string; question: string; answer: string; category: string; published: boolean; updatedAt: number }
interface Form { id: string; question: string; answer: string; category: string; published: boolean }
const rows = ref<Faq[]>([]), loading = ref(true), saving = ref(false), form = ref<Form | null>(null)
const editor = ref<HTMLElement | null>(null)
const cats = computed(() => [...new Set(rows.value.map(r => r.category).filter(Boolean))].sort())
const blank = (): Form => ({ id: '', question: '', answer: '', category: '', published: true })

async function load(): Promise<void> {
  try { rows.value = await api<Faq[]>('/admin/faqs') } catch (e) { fail(e) } finally { loading.value = false }
}
onMounted(load)

async function open(f: Form): Promise<void> { form.value = f; await nextTick(); editor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
async function save(): Promise<void> {
  const f = form.value
  if (!f) return
  saving.value = true
  try {
    const body = { question: f.question, answer: f.answer, category: f.category, published: f.published }
    if (f.id) await api(`/admin/faqs/${f.id}`, { method: 'PUT', body }); else await api('/admin/faqs', { method: 'POST', body })
    ok(f.id ? 'Question saved' : 'Question added')
    form.value = null
    await load()
  } catch (e) { fail(e) } finally { saving.value = false }
}
async function move(i: number, d: -1 | 1): Promise<void> {
  const a = rows.value.slice(), j = i + d
  if (j < 0 || j >= a.length) return
  ;[a[i], a[j]] = [a[j] as Faq, a[i] as Faq]
  rows.value = a
  try { await api('/admin/faqs/reorder', { method: 'POST', body: { ids: a.map(r => r.id) } }) } catch (e) { fail(e); await load() }
}
async function toggle(r: Faq): Promise<void> {
  try { await api(`/admin/faqs/${r.id}`, { method: 'PUT', body: { question: r.question, answer: r.answer, category: r.category, published: !r.published } }); ok(r.published ? 'Hidden from the website' : 'Published'); await load() } catch (e) { fail(e) }
}
async function del(r: Faq): Promise<void> {
  if (!await confirmDialog('Delete question', `"${r.question}" will be removed permanently.`)) return
  try { await api(`/admin/faqs/${r.id}`, { method: 'DELETE' }); ok('Deleted'); await load() } catch (e) { fail(e) }
}
</script>

<template>
  <div class="space-y-4 max-w-4xl">
    <div class="flex items-center gap-3"><h1 class="text-2xl font-bold mr-auto">FAQ</h1><button class="btn btn-accent" data-testid="new-faq" @click="open(blank())"><Icon name="plus" />Add question</button></div>
    <p class="text-sm text-muted">Shown on the website's FAQ page, in this order. Answers support Markdown (bold, lists, links). Hidden questions stay here but are not public.</p>

    <form v-if="form" ref="editor" class="card p-4 space-y-3" data-testid="faq-form" @submit.prevent="save">
      <h2 class="font-semibold">{{ form.id ? 'Edit question' : 'New question' }}</h2>
      <div><label class="label" for="faq-q">Question</label><input id="faq-q" v-model="form.question" class="input" maxlength="300" required minlength="3"></div>
      <div><label class="label" for="faq-a">Answer (Markdown)</label><textarea id="faq-a" v-model="form.answer" class="input font-mono !text-[13px]" rows="6" maxlength="5000" required /></div>
      <div class="grid sm:grid-cols-2 gap-3 items-end">
        <div><label class="label" for="faq-c">Group <span class="font-normal text-muted">(optional, e.g. Privacy)</span></label><input id="faq-c" v-model="form.category" class="input" maxlength="60" list="faq-groups"><datalist id="faq-groups"><option v-for="c in cats" :key="c" :value="c" /></datalist></div>
        <label class="flex items-center gap-2 h-10 text-sm font-medium"><input v-model="form.published" type="checkbox" class="size-4 accent-[var(--accent)]">Show on the website</label>
      </div>
      <div class="flex gap-2"><button class="btn btn-accent" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button><button type="button" class="btn" @click="form = null">Cancel</button></div>
    </form>

    <div class="card divide-y divide-line">
      <div v-for="(r, i) in rows" :key="r.id" class="p-3 sm:p-4 flex gap-3 items-start" :data-question="r.question">
        <div class="flex flex-col">
          <button class="btn !min-h-7 !px-1.5" :disabled="i === 0" :aria-label="`Move up: ${r.question}`" @click="move(i, -1)"><Icon name="up" :size="15" /></button>
          <button class="btn !min-h-7 !px-1.5 mt-1" :disabled="i === rows.length - 1" :aria-label="`Move down: ${r.question}`" @click="move(i, 1)"><Icon name="down" :size="15" /></button>
        </div>
        <div class="min-w-0 flex-1" :class="r.published ? '' : 'opacity-60'">
          <p class="font-medium">{{ r.question }} <span v-if="r.category" class="badge ml-1">{{ r.category }}</span> <span v-if="!r.published" class="badge ml-1">hidden</span></p>
          <p class="text-sm text-muted mt-1 line-clamp-2 whitespace-pre-line">{{ r.answer }}</p>
        </div>
        <div class="flex flex-wrap gap-1.5 justify-end shrink-0">
          <button class="btn !min-h-8" @click="open({ ...r })"><Icon name="edit" :size="15" />Edit</button>
          <button class="btn !min-h-8" @click="toggle(r)">{{ r.published ? 'Hide' : 'Publish' }}</button>
          <button class="btn btn-danger !min-h-8" :aria-label="`Delete ${r.question}`" @click="del(r)"><Icon name="trash" :size="15" /></button>
        </div>
      </div>
      <p v-if="!rows.length" class="p-10 text-center text-muted">{{ loading ? 'Loading...' : 'No questions yet. Add the first one.' }}</p>
    </div>
  </div>
</template>
