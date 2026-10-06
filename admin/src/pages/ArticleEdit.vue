<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import MediaGrid, { type MediaItem } from '../components/MediaGrid.vue'
import { confirmDialog, fail, ok } from '../ui'

const route = useRoute(), router = useRouter()
const isNew = computed(() => route.params.id === 'new')
const id = ref<string | null>(isNew.value ? null : String(route.params.id))
const f = reactive({ title: '', slug: '', excerpt: '', body: '', coverMediaId: null as string | null, ogMediaId: null as string | null, categoryId: '' as string | null, tags: [] as string[], seoTitle: '', seoDescription: '', status: 'draft', publishAt: '' })
const slugLocked = ref(false), tagInput = ref(''), html = ref(''), saving = ref(false), dirty = ref(false), loaded = ref(isNew.value)
const cats = ref<{ id: string; name: string }[]>([]), allTags = ref<{ name: string }[]>([])
const picker = ref<null | 'cover' | 'og' | 'inline'>(null)
const covers = reactive<Record<string, string>>({})
const ta = ref<HTMLTextAreaElement | null>(null)
const scheduling = ref(false)

const slugify = (s: string): string => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
const snippetTitle = computed(() => f.seoTitle || f.title || 'Article title')
const snippetDesc = computed(() => f.seoDescription || f.excerpt || 'The description shown in search results.')

function payload(status = f.status): Record<string, unknown> {
  return { title: f.title, ...(f.slug ? { slug: f.slug } : {}), excerpt: f.excerpt, body: f.body, coverMediaId: f.coverMediaId, ogMediaId: f.ogMediaId, categoryId: f.categoryId || null, tags: f.tags,
    seoTitle: f.seoTitle, seoDescription: f.seoDescription, status, publishAt: status === 'scheduled' && f.publishAt ? new Date(f.publishAt).toISOString() : null }
}
async function save(status = f.status, quiet = false): Promise<void> {
  if (!f.title.trim()) { if (!quiet) fail(new Error('Add a title first')); return }
  saving.value = true
  try {
    const r = await api<{ id: string; slug: string }>(id.value ? `/admin/articles/${id.value}` : '/admin/articles', { method: id.value ? 'PUT' : 'POST', body: payload(status) })
    f.status = status; f.slug = r.slug; slugLocked.value = true; dirty.value = false
    if (!id.value) { id.value = r.id; await router.replace(`/articles/${r.id}`) }
    if (!quiet) ok(status === 'published' ? 'Published' : status === 'scheduled' ? 'Scheduled' : status === 'archived' ? 'Archived' : 'Saved')
  } catch (e) { if (!quiet) fail(e) } finally { saving.value = false }
}
const publish = (): Promise<void> => save('published')
async function schedule(): Promise<void> { if (!f.publishAt) { scheduling.value = true; return } await save('scheduled'); scheduling.value = false }

async function load(): Promise<void> {
  cats.value = await api<{ id: string; name: string }[]>('/admin/categories').catch(() => [])
  allTags.value = await api<{ name: string }[]>('/admin/tags').catch(() => [])
  if (!id.value) return
  try {
    const a = await api<Record<string, any>>(`/admin/articles/${id.value}`)
    Object.assign(f, { title: a.title, slug: a.slug, excerpt: a.excerpt, body: a.body, coverMediaId: a.coverMediaId, ogMediaId: a.ogMediaId, categoryId: a.categoryId ?? '', tags: a.tags, seoTitle: a.seoTitle, seoDescription: a.seoDescription, status: a.status, publishAt: a.publishAt ? new Date(a.publishAt).toISOString().slice(0, 16) : '' })
    slugLocked.value = true
    for (const m of [a.coverMediaId, a.ogMediaId]) if (m) void coverUrl(m)
  } catch (e) { fail(e) }
  loaded.value = true; dirty.value = false
}
async function coverUrl(mid: string): Promise<void> {
  const list = await api<{ items: MediaItem[] }>('/admin/media').catch(() => ({ items: [] as MediaItem[] }))
  const m = list.items.find(x => x.id === mid)
  if (m) covers[mid] = `/media/${m.variants.find(v => v.w >= 480)?.path ?? m.variants[0]?.path}`
}
onMounted(load)

watch(() => f.title, t => { if (!slugLocked.value) f.slug = slugify(t) })
watch(f, () => { if (loaded.value) dirty.value = true }, { deep: true })
let prevT: ReturnType<typeof setTimeout>
watch(() => f.body, b => { clearTimeout(prevT); prevT = setTimeout(async () => { try { html.value = (await api<{ html: string }>('/admin/articles/preview', { method: 'POST', body: { body: b } })).html } catch { /* preview is best effort */ } }, 500) })
const auto = setInterval(() => { if (dirty.value && f.status === 'draft' && f.title.trim()) void save('draft', true) }, 20_000)
const beforeUnload = (e: BeforeUnloadEvent): void => { if (dirty.value) e.preventDefault() }
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => { clearInterval(auto); window.removeEventListener('beforeunload', beforeUnload) })
onBeforeRouteLeave(async () => (dirty.value ? await confirmDialog('Leave without saving?', 'You have unsaved changes in this article.') : true))

function wrap(before: string, after = before, placeholder = 'text'): void {
  const el = ta.value; if (!el) return
  const { selectionStart: s, selectionEnd: e } = el
  const sel = f.body.slice(s, e) || placeholder
  f.body = f.body.slice(0, s) + before + sel + after + f.body.slice(e)
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length) })
}
function linePrefix(p: string): void {
  const el = ta.value; if (!el) return
  const start = f.body.lastIndexOf('\n', el.selectionStart - 1) + 1
  f.body = f.body.slice(0, start) + p + f.body.slice(start)
  requestAnimationFrame(() => el.focus())
}
const tools: [string, () => void, string][] = [['B', () => wrap('**'), 'Bold'], ['I', () => wrap('*'), 'Italic'], ['H2', () => linePrefix('## '), 'Heading 2'], ['H3', () => linePrefix('### '), 'Heading 3'],
  ['Link', () => wrap('[', '](https://)', 'link text'), 'Link'], ['List', () => linePrefix('- '), 'List'], ['Code', () => wrap('`'), 'Code'], ['Quote', () => linePrefix('> '), 'Quote'], ['Image', () => { picker.value = 'inline' }, 'Insert image']]
function chosen(m: MediaItem): void {
  const url = `/media/${m.variants.at(-1)?.path}`
  if (picker.value === 'cover') f.coverMediaId = m.id
  else if (picker.value === 'og') f.ogMediaId = m.id
  else { const el = ta.value, at = el?.selectionStart ?? f.body.length; f.body = `${f.body.slice(0, at)}![${m.alt || m.filename}](${url})${f.body.slice(at)}` }
  covers[m.id] = `/media/${m.variants.find(v => v.w >= 480)?.path ?? m.variants[0]?.path}`
  picker.value = null
}
function addTag(): void {
  for (const t of tagInput.value.split(',').map(x => x.trim()).filter(Boolean)) if (!f.tags.includes(t) && f.tags.length < 12) f.tags.push(t)
  tagInput.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <h1 class="text-2xl font-bold mr-auto">{{ isNew && !id ? 'New article' : 'Edit article' }} <span class="badge align-middle">{{ f.status }}</span></h1>
      <span v-if="dirty" class="text-xs text-muted">Unsaved changes</span>
      <button class="btn" :disabled="saving" data-testid="save-draft" @click="save(f.status === 'published' ? 'published' : 'draft')">{{ f.status === 'published' ? 'Save' : 'Save draft' }}</button>
      <button class="btn" :disabled="saving" @click="schedule">Schedule</button>
      <button v-if="id && f.status !== 'archived'" class="btn" :disabled="saving" @click="save('archived')">Archive</button>
      <button class="btn btn-accent" :disabled="saving" data-testid="publish" @click="publish">{{ f.status === 'published' ? 'Update' : 'Publish' }}</button>
    </div>
    <div v-if="scheduling" class="card p-3 flex flex-wrap items-center gap-2"><label class="text-sm font-medium" for="when">Publish at</label><input id="when" v-model="f.publishAt" type="datetime-local" class="input !w-auto"><button class="btn btn-accent" @click="schedule">Schedule</button><button class="btn" @click="scheduling = false">Cancel</button></div>

    <div class="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
      <div class="space-y-3 min-w-0">
        <div><label class="label" for="title">Title</label><input id="title" v-model="f.title" class="input !text-lg font-semibold" maxlength="200" placeholder="Article title"></div>
        <div class="grid sm:grid-cols-2 gap-3">
          <div><label class="label" for="slug">Slug</label><div class="flex gap-1"><input id="slug" v-model="f.slug" class="input" :disabled="slugLocked" maxlength="100"><button class="btn !px-2.5" :aria-label="slugLocked ? 'Unlock slug' : 'Lock slug'" @click="slugLocked = !slugLocked">{{ slugLocked ? 'Edit' : 'Lock' }}</button></div></div>
          <div><label class="label" for="cat">Category</label><select id="cat" v-model="f.categoryId" class="input"><option value="">None</option><option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
        </div>
        <div><label class="label" for="ex">Excerpt</label><textarea id="ex" v-model="f.excerpt" class="input" rows="2" maxlength="500" /></div>
        <div>
          <div class="flex flex-wrap gap-1 mb-1" role="toolbar" aria-label="Formatting"><button v-for="t in tools" :key="t[0]" type="button" class="btn !min-h-8 !px-2.5 text-xs" :aria-label="t[2]" @click="t[1]()">{{ t[0] }}</button></div>
          <div class="grid md:grid-cols-2 gap-3">
            <textarea ref="ta" v-model="f.body" class="input font-mono !text-[13px] leading-relaxed min-h-[26rem]" aria-label="Markdown body" placeholder="Write in Markdown..." />
            <div class="card p-4 min-h-[26rem] overflow-auto prose-prev" aria-label="Preview" v-html="html || '<p style=&quot;color:var(--muted)&quot;>Live preview appears here.</p>'" />
          </div>
        </div>
      </div>

      <aside class="space-y-3">
        <div class="card p-3 space-y-2"><p class="label">Cover image</p>
          <img v-if="f.coverMediaId && covers[f.coverMediaId]" :src="covers[f.coverMediaId]" alt="" class="w-full rounded-lg aspect-video object-cover">
          <div class="flex gap-2"><button class="btn flex-1" data-testid="pick-cover" @click="picker = 'cover'">{{ f.coverMediaId ? 'Change' : 'Choose' }}</button><button v-if="f.coverMediaId" class="btn" @click="f.coverMediaId = null">Remove</button></div></div>
        <div class="card p-3 space-y-2"><p class="label">Social image (optional)</p>
          <img v-if="f.ogMediaId && covers[f.ogMediaId]" :src="covers[f.ogMediaId]" alt="" class="w-full rounded-lg aspect-video object-cover">
          <div class="flex gap-2"><button class="btn flex-1" @click="picker = 'og'">{{ f.ogMediaId ? 'Change' : 'Choose' }}</button><button v-if="f.ogMediaId" class="btn" @click="f.ogMediaId = null">Remove</button></div></div>
        <div class="card p-3 space-y-2"><label class="label" for="tg">Tags</label>
          <div class="flex flex-wrap gap-1"><span v-for="t in f.tags" :key="t" class="badge">{{ t }} <button :aria-label="`Remove ${t}`" class="ml-1" @click="f.tags = f.tags.filter(x => x !== t)">x</button></span></div>
          <input id="tg" v-model="tagInput" class="input" list="tag-list" placeholder="Add tag, press Enter" @keydown.enter.prevent="addTag" @change="addTag"><datalist id="tag-list"><option v-for="t in allTags" :key="t.name" :value="t.name" /></datalist></div>
        <div class="card p-3 space-y-2"><p class="label">SEO</p>
          <div><input v-model="f.seoTitle" class="input" placeholder="SEO title" maxlength="120" aria-label="SEO title"><p class="text-xs mt-1" :class="f.seoTitle.length > 60 ? 'text-accent-ink' : 'text-muted'">{{ f.seoTitle.length }}/60</p></div>
          <div><textarea v-model="f.seoDescription" class="input" rows="3" maxlength="300" placeholder="Meta description" aria-label="SEO description" /><p class="text-xs mt-1" :class="f.seoDescription.length > 160 ? 'text-accent-ink' : 'text-muted'">{{ f.seoDescription.length }}/160</p></div>
          <div class="rounded-lg bg-surface-2 p-3 text-sm" aria-label="Search result preview"><p class="text-[#1a0dab] dark:text-[#8ab4f8] text-base leading-snug truncate">{{ snippetTitle }}</p><p class="text-xs text-ok truncate">/blog/{{ f.slug || 'slug' }}</p><p class="text-xs text-muted line-clamp-2">{{ snippetDesc }}</p></div></div>
      </aside>
    </div>

    <div v-if="picker" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="Choose image" @keydown.esc="picker = null">
      <div class="card w-full max-w-4xl max-h-[90dvh] overflow-y-auto p-4 space-y-3"><div class="flex items-center"><h2 class="font-semibold text-lg mr-auto">Choose an image</h2><button class="btn" @click="picker = null">Close</button></div><MediaGrid pick @select="chosen" /></div>
    </div>
  </div>
</template>
