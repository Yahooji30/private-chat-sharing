<script setup lang="ts">
import { LIMITS } from '@sync/shared'
const props = defineProps<{ slug?: string; token?: string }>()
const toast = useToast()
const editing = !!props.slug
const form = reactive({ title: '', body: '', slug: '', indexable: false })
const tab = ref<'write' | 'preview'>('write')
const html = ref('')
const busy = ref(false)
const done = ref<{ slug: string; editToken?: string } | null>(null)
const headers = computed(() => (props.token ? { 'x-edit-token': props.token } : undefined))

onMounted(async () => {
  if (!editing) return
  try {
    const p = await api<{ title: string; body: string; indexable: boolean }>(`/public-pages/${props.slug}`, { headers: headers.value })
    Object.assign(form, { title: p.title, body: p.body, indexable: p.indexable })
  } catch (e) { toast.err((e as Error).message) }
})
let t: ReturnType<typeof setTimeout> | undefined
watch(() => form.body, b => {
  clearTimeout(t)
  t = setTimeout(async () => { html.value = (await renderPreview(b)) }, 250)
})
async function renderPreview(src: string): Promise<string> {
  const esc = src.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
  return esc.split(/\n{2,}/).map(p => {
    const h = /^(#{1,3})\s+(.*)$/.exec(p)
    if (h?.[1] && h[2] !== undefined) return `<h${h[1].length}>${h[2]}</h${h[1].length}>`
    return `<p>${p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`
  }).join('')
}

async function submit(): Promise<void> {
  busy.value = true
  try {
    if (editing) {
      await api(`/public-pages/${props.slug}`, { method: 'PUT', body: { title: form.title, body: form.body, indexable: form.indexable }, headers: headers.value })
      toast.ok('Saved'); await navigateTo(`/p/${props.slug}`)
    } else {
      done.value = await api('/public-pages', { method: 'POST', body: { title: form.title, body: form.body, indexable: form.indexable, ...(form.slug ? { slug: form.slug } : {}) } })
    }
  } catch (e) { toast.err((e as Error).message) } finally { busy.value = false }
}
const url = computed(() => (done.value ? `${location.origin}/p/${done.value.slug}` : ''))
const editUrl = computed(() => (done.value?.editToken ? `${location.origin}/public/${done.value.slug}/edit?k=${done.value.editToken}` : ''))
async function copy(v: string, l: string): Promise<void> { if (await copyText(v)) toast.ok(`${l} copied`) }
</script>

<template>
  <div class="max-w-3xl mx-auto pt-3 md:pt-6">
    <div v-if="done" class="card p-6 space-y-4 text-center anim-pop">
      <div class="size-14 mx-auto rounded-2xl bg-accent-soft text-accent-ink grid place-items-center"><Icon name="checkCircle" :size="28" /></div>
      <h1 class="text-2xl font-bold">Your page is live</h1>
      <div class="flex gap-2"><code class="flex-1 truncate px-3 py-2.5 rounded-lg bg-surface-2 border border-line text-sm font-mono text-left">{{ url }}</code><button class="btn" @click="copy(url, 'Link')"><Icon name="copy" :size="15" />Copy</button></div>
      <details class="text-left text-sm"><summary class="cursor-pointer text-muted">Edit link for other networks (keep it secret)</summary>
        <div class="flex gap-2 mt-2"><code class="flex-1 truncate px-3 py-2.5 rounded-lg bg-surface-2 border border-line text-xs font-mono">{{ editUrl }}</code><button class="btn" @click="copy(editUrl, 'Edit link')">Copy</button></div></details>
      <div class="flex gap-2 justify-center"><NuxtLink :to="`/p/${done.slug}`" class="btn btn-accent">View page</NuxtLink><NuxtLink to="/public" class="btn">All pages</NuxtLink></div>
    </div>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <h1 class="text-2xl font-bold">{{ editing ? 'Edit page' : 'New public page' }}</h1>
      <label class="block"><span class="text-sm font-medium">Title</span><input v-model="form.title" class="input mt-1.5" maxlength="120" required placeholder="My page"></label>
      <div>
        <div class="flex items-center mb-1.5"><span class="text-sm font-medium mr-auto">Content <span class="text-muted font-normal">(Markdown)</span></span>
          <div class="md:hidden inline-flex rounded-lg bg-surface-2 p-0.5 text-sm"><button type="button" class="px-3 py-1 rounded-md" :class="tab === 'write' ? 'bg-surface shadow-sm' : 'text-muted'" @click="tab = 'write'">Write</button>
            <button type="button" class="px-3 py-1 rounded-md" :class="tab === 'preview' ? 'bg-surface shadow-sm' : 'text-muted'" @click="tab = 'preview'">Preview</button></div></div>
        <div class="grid md:grid-cols-2 gap-3">
          <textarea v-model="form.body" :class="tab === 'preview' ? 'hidden md:block' : ''" class="input !min-h-72 py-3 font-mono text-[15px] leading-relaxed resize-y" :maxlength="LIMITS.pageBodyChars" required placeholder="# Hello&#10;Write something..." />
          <div :class="tab === 'write' ? 'hidden md:block' : ''" class="card p-4 min-h-72 prose-page overflow-auto" aria-label="Preview" v-html="html || '<p style=&quot;color:var(--muted)&quot;>Preview appears here.</p>'" />
        </div>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <label v-if="!editing" class="block"><span class="text-sm font-medium">Custom link <span class="text-muted font-normal">(optional)</span></span>
          <input v-model="form.slug" class="input mt-1.5" pattern="[a-z0-9\-]{3,60}" placeholder="my-page" autocomplete="off"></label>
        <label class="flex items-center gap-3 card px-4 min-h-11 self-end"><Toggle v-model="form.indexable" label="Allow search engines" /><span class="text-sm">Allow search engines</span></label>
      </div>
      <button class="btn btn-accent w-full sm:w-auto !min-h-12 px-8" :disabled="busy || !form.title || !form.body">{{ editing ? 'Save changes' : 'Publish' }}</button>
    </form>
  </div>
</template>
