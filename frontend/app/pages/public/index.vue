<script setup lang="ts">
import { fmtAgo } from '~/utils/format'
useHead({ title: 'Public pages', meta: [{ name: 'robots', content: 'noindex' }] })
interface Row { slug: string; title: string; views: number; updatedAt: number; status: string }
const toast = useToast()
const app = useApp()
const rows = ref<Row[] | null>(null)
onMounted(async () => { try { rows.value = await api<Row[]>('/public-pages') } catch (e) { toast.err((e as Error).message); rows.value = [] } })
async function del(r: Row): Promise<void> {
  if (!confirm(`Delete /p/${r.slug}?`)) return
  try { await api(`/public-pages/${r.slug}`, { method: 'DELETE' }); rows.value = (rows.value ?? []).filter(x => x.slug !== r.slug); toast.ok('Deleted') } catch (e) { toast.err((e as Error).message) }
}
async function copy(r: Row): Promise<void> { if (await copyText(`${app.blogUrl || location.origin}/p/${r.slug}`)) toast.ok('Link copied') }
</script>

<template>
  <div class="max-w-3xl mx-auto pt-3 md:pt-6">
    <div class="flex items-center gap-3 mb-4"><div class="mr-auto"><h1 class="text-2xl font-bold">Public pages</h1><p class="text-sm text-muted">Publish text to a shareable link anyone can open.</p></div>
      <NuxtLink to="/public/new" class="btn btn-accent"><Icon name="plus" :size="16" />New page</NuxtLink></div>
    <p v-if="!rows" class="text-muted p-6 text-center">Loading...</p>
    <div v-else-if="!rows.length" class="card p-10 text-center space-y-3"><Icon name="globe" :size="32" class="mx-auto text-muted" /><p class="font-medium">No pages yet</p><p class="text-sm text-muted">Write something and get a public link in one click.</p>
      <NuxtLink to="/public/new" class="btn btn-soft">Create your first page</NuxtLink></div>
    <ul v-else class="space-y-2">
      <li v-for="r in rows" :key="r.slug" class="card p-4 flex items-center gap-3">
        <div class="min-w-0 mr-auto"><a :href="`${app.blogUrl}/p/${r.slug}`" class="font-semibold hover:underline truncate block">{{ r.title }}</a>
          <p class="text-xs text-muted truncate">/p/{{ r.slug }} · <Icon name="eye" :size="12" class="inline" /> {{ r.views }} · {{ fmtAgo(r.updatedAt) }}<span v-if="r.status !== 'published'" class="text-accent-ink"> · unpublished</span></p></div>
        <button class="btn !px-2.5" aria-label="Copy link" @click="copy(r)"><Icon name="copy" :size="16" /></button>
        <NuxtLink :to="`/public/${r.slug}/edit`" class="btn !px-3">Edit</NuxtLink>
        <button class="btn !px-2.5" :aria-label="`Delete ${r.title}`" @click="del(r)"><Icon name="trash" :size="16" /></button>
      </li>
    </ul>
  </div>
</template>
