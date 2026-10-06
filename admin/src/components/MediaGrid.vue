<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, upload } from '../api'
import { confirmDialog, fail, fmtBytes, ok } from '../ui'

export interface MediaItem { id: string; filename: string; width: number; height: number; bytes: number; alt: string; variants: { w: number; h: number; path: string }[] }
const props = defineProps<{ pick?: boolean }>()
const emit = defineEmits<{ select: [MediaItem] }>()
const items = ref<MediaItem[]>([]), progress = ref<Record<string, number>>({}), over = ref(false), input = ref<HTMLInputElement | null>(null)
const thumb = (m: MediaItem): string => `/media/${(m.variants.find(v => v.w >= 480) ?? m.variants.at(-1))?.path}`
const big = (m: MediaItem): string => `${location.origin}/media/${m.variants.at(-1)?.path}`

async function load(): Promise<void> { try { items.value = (await api<{ items: MediaItem[] }>('/admin/media')).items } catch (e) { fail(e) } }
onMounted(load)
async function send(files: FileList | File[]): Promise<void> {
  for (const f of Array.from(files)) {
    progress.value = { ...progress.value, [f.name]: 0 }
    try { const m = await upload<MediaItem>('/admin/media', f, p => { progress.value = { ...progress.value, [f.name]: p } }); items.value = [m, ...items.value]; ok(`Uploaded ${f.name}`) } catch (e) { fail(e) }
    const { [f.name]: _, ...rest } = progress.value; progress.value = rest
  }
}
async function alt(m: MediaItem): Promise<void> { try { await api(`/admin/media/${m.id}`, { method: 'PATCH', body: { alt: m.alt } }); ok('Alt text saved') } catch (e) { fail(e) } }
async function del(m: MediaItem): Promise<void> {
  if (!await confirmDialog('Delete image', `"${m.filename}" will be removed permanently.`)) return
  try { await api(`/admin/media/${m.id}`, { method: 'DELETE' }); items.value = items.value.filter(x => x.id !== m.id); ok('Deleted') } catch (e) { fail(e) }
}
async function copy(m: MediaItem): Promise<void> { await navigator.clipboard.writeText(big(m)).then(() => ok('URL copied'), () => fail(new Error('Copy failed'))) }
void props
</script>

<template>
  <div>
    <div class="card border-dashed p-6 text-center cursor-pointer transition" :class="over ? 'border-accent bg-accent-soft' : ''" role="button" tabindex="0" aria-label="Upload images"
      @click="input?.click()" @keydown.enter="input?.click()" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; send($event.dataTransfer?.files ?? [])">
      <p class="font-medium">Drop images here or click to upload</p><p class="text-sm text-muted">JPG, PNG, WebP or GIF up to 10 MB. Converted to WebP automatically.</p>
      <input ref="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple class="hidden" data-testid="media-input" @change="send(($event.target as HTMLInputElement).files ?? [])">
    </div>
    <div v-for="(p, n) in progress" :key="n" class="mt-2 text-sm"><span>{{ n }}</span><div class="h-1.5 bg-line rounded mt-1"><div class="h-full bg-accent rounded" :style="{ width: p + '%' }" /></div></div>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
      <div v-for="m in items" :key="m.id" class="card overflow-hidden flex flex-col" :data-media="m.filename">
        <button class="block bg-surface-2" :aria-label="pick ? `Select ${m.filename}` : m.filename" @click="pick ? emit('select', m) : copy(m)"><img :src="thumb(m)" :alt="m.alt" class="w-full aspect-[4/3] object-cover" loading="lazy"></button>
        <div class="p-2 space-y-1.5 text-xs">
          <p class="truncate font-medium" :title="m.filename">{{ m.filename }}</p><p class="text-muted">{{ m.width }}x{{ m.height }} · {{ fmtBytes(m.bytes) }}</p>
          <template v-if="!pick"><input v-model="m.alt" class="input !min-h-8 !text-xs" placeholder="Alt text" :aria-label="`Alt text for ${m.filename}`" @change="alt(m)">
            <div class="flex gap-1"><button class="btn !min-h-8 flex-1" @click="copy(m)">Copy URL</button><button class="btn btn-danger !min-h-8" :aria-label="`Delete ${m.filename}`" @click="del(m)">Delete</button></div></template>
        </div>
      </div>
    </div>
    <p v-if="!items.length" class="text-center text-muted py-10">No images yet.</p>
  </div>
</template>
