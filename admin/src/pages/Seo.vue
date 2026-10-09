<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import MediaGrid, { type MediaItem } from '../components/MediaGrid.vue'
import { fail, ok } from '../ui'

interface Row {
  key: string; label: string; site: 'app' | 'site'; path: string
  title: string; description: string; keywords: string; ogTitle: string; ogDescription: string; ogMediaId: string | null; canonical: string; noindex: boolean; updatedAt: number | null
}
const rows = ref<Row[]>([]), sel = ref(0), saving = ref(false), picker = ref(false), thumb = ref<Record<string, string>>({})
const saved = ref<Record<string, string>>({})
const snap = (r: Row): string => JSON.stringify([r.title, r.description, r.keywords, r.ogTitle, r.ogDescription, r.ogMediaId, r.canonical, r.noindex])
const cur = computed(() => rows.value[sel.value])
const dirty = (r: Row): boolean => saved.value[r.key] !== snap(r)
const groups = computed(() => [['App (home and secure chat)', rows.value.filter(r => r.site === 'app')], ['Website (blog, features, FAQ, feedback, legal)', rows.value.filter(r => r.site === 'site')]] as const)

async function load(): Promise<void> {
  try {
    rows.value = await api<Row[]>('/admin/seo')
    saved.value = Object.fromEntries(rows.value.map(r => [r.key, snap(r)]))
    const m = await api<{ items: MediaItem[] }>('/admin/media').catch(() => ({ items: [] as MediaItem[] }))
    thumb.value = Object.fromEntries(m.items.map(i => [i.id, `/media/${(i.variants.find(v => v.w >= 480) ?? i.variants.at(-1))?.path}`]))
  } catch (e) { fail(e) }
}
onMounted(load)

async function save(): Promise<void> {
  const r = cur.value
  if (!r) return
  saving.value = true
  try {
    await api(`/admin/seo/${r.key}`, { method: 'PUT', body: { title: r.title, description: r.description, keywords: r.keywords, ogTitle: r.ogTitle, ogDescription: r.ogDescription, ogMediaId: r.ogMediaId, canonical: r.canonical, noindex: r.noindex } })
    saved.value = { ...saved.value, [r.key]: snap(r) }
    ok(`${r.label} saved`)
  } catch (e) { fail(e) } finally { saving.value = false }
}
function reset(): void {
  const r = cur.value
  if (!r) return
  Object.assign(r, { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogMediaId: null, canonical: '', noindex: false })
}
function chosen(m: MediaItem): void {
  if (cur.value) { cur.value.ogMediaId = m.id; thumb.value = { ...thumb.value, [m.id]: `/media/${(m.variants.find(v => v.w >= 480) ?? m.variants.at(-1))?.path}` } }
  picker.value = false
}
const meter = (n: number, max: number): string => (n === 0 ? 'text-muted' : n > max ? 'text-accent-ink font-semibold' : 'text-ok')
</script>

<template>
  <div class="space-y-4 max-w-4xl">
    <h1 class="text-2xl font-bold">SEO</h1>
    <p class="text-sm text-muted">What search engines and social networks show for each page. Anything left empty uses the page's built-in text, so you only fill in what you want to change.</p>

    <div v-for="g in groups" :key="g[0]"><p class="label text-muted">{{ g[0] }}</p>
      <div class="flex flex-wrap gap-2"><button v-for="r in g[1]" :key="r.key" class="btn" :class="cur?.key === r.key ? '!border-accent bg-accent-soft text-accent-ink' : ''" :data-seo="r.key" @click="sel = rows.indexOf(r)">
        {{ r.label.replace(/^(App|Site): /, '') }}<span v-if="dirty(r)" class="size-2 rounded-full bg-warn" title="Unsaved changes" /><span v-else-if="r.noindex" class="badge">noindex</span></button></div></div>

    <form v-if="cur" :key="cur.key" class="card p-4 space-y-4" data-testid="seo-form" @submit.prevent="save">
      <div class="flex items-center gap-2"><h2 class="font-semibold mr-auto">{{ cur.label }} <code class="ml-1 text-xs text-muted">{{ cur.path }}</code></h2><button type="button" class="btn !min-h-8 text-muted" @click="reset">Clear all</button></div>

      <div class="rounded-xl border border-line bg-surface-2 p-3" aria-label="Search result preview">
        <p class="text-xs text-muted">Search result preview</p>
        <p class="text-[1.05rem] text-[#1a0dab] dark:text-[#8ab4f8] truncate mt-1">{{ cur.title || 'Built-in page title' }}</p>
        <p class="text-xs text-ok truncate">{{ cur.canonical || `yoursite.com${cur.path === '/' ? '' : cur.path}` }}</p>
        <p class="text-sm text-muted line-clamp-2">{{ cur.description || 'Built-in page description.' }}</p>
      </div>

      <div><label class="label" for="seo-title">Page title <span class="font-normal float-right" :class="meter(cur.title.length, 60)">{{ cur.title.length }}/60 recommended</span></label><input id="seo-title" v-model="cur.title" class="input" maxlength="120"></div>
      <div><label class="label" for="seo-desc">Meta description <span class="font-normal float-right" :class="meter(cur.description.length, 160)">{{ cur.description.length }}/160 recommended</span></label><textarea id="seo-desc" v-model="cur.description" class="input" rows="3" maxlength="320" /></div>
      <div><label class="label" for="seo-kw">Keywords <span class="font-normal text-muted">(comma separated, optional)</span></label><input id="seo-kw" v-model="cur.keywords" class="input" maxlength="300"></div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div><label class="label" for="seo-ogt">Social share title <span class="font-normal text-muted">(WhatsApp, Facebook, X)</span></label><input id="seo-ogt" v-model="cur.ogTitle" class="input" maxlength="120" placeholder="Same as page title"></div>
        <div><label class="label" for="seo-ogd">Social share description</label><input id="seo-ogd" v-model="cur.ogDescription" class="input" maxlength="320" placeholder="Same as meta description"></div>
      </div>
      <div><span class="label">Social share image</span>
        <div class="flex items-center gap-3"><img v-if="cur.ogMediaId && thumb[cur.ogMediaId]" :src="thumb[cur.ogMediaId]" alt="" class="h-16 w-28 object-cover rounded-lg border border-line">
          <button type="button" class="btn" @click="picker = true">{{ cur.ogMediaId ? 'Change image' : 'Choose image' }}</button><button v-if="cur.ogMediaId" type="button" class="btn" @click="cur.ogMediaId = null">Remove</button>
          <span v-if="!cur.ogMediaId" class="text-sm text-muted">Optional. 1200x630 works best.</span></div></div>

      <div><label class="label" for="seo-can">Canonical URL <span class="font-normal text-muted">(optional, only if this page lives at another address)</span></label><input id="seo-can" v-model="cur.canonical" class="input" type="url" maxlength="300" placeholder="https://"></div>
      <label class="flex items-start gap-2 text-sm"><input v-model="cur.noindex" type="checkbox" class="size-4 mt-0.5 accent-[var(--accent)]"><span><strong>Hide from search engines</strong> (noindex). The page also leaves the sitemap.</span></label>

      <div class="flex gap-2"><button class="btn btn-accent" :disabled="saving || !dirty(cur)">{{ saving ? 'Saving...' : 'Save' }}</button><span v-if="dirty(cur)" class="text-sm text-muted self-center">Unsaved changes</span></div>
    </form>

    <div v-if="picker" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-label="Choose image" @keydown.esc="picker = false">
      <div class="card w-full max-w-4xl max-h-[90dvh] overflow-y-auto p-4 space-y-3"><div class="flex items-center"><h2 class="font-semibold text-lg mr-auto">Choose an image</h2><button class="btn" @click="picker = false">Close</button></div><MediaGrid pick @select="chosen" /></div>
    </div>
  </div>
</template>
