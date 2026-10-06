<script setup lang="ts">
import type { FileItem } from '~/stores/files'
import { fmtBytes, fmtDuration } from '~/utils/format'

const files = useFiles()
const app = useApp()
const input = useTemplateRef<HTMLInputElement>('input')
const dragging = ref(false)
const view = reactive<{ item: FileItem | null; url: string; text: string }>({ item: null, url: '', text: '' })
let dragDepth = 0

const sorted = computed(() => files.items)
const anyDone = computed(() => files.items.some(i => i.status === 'complete'))
const anyMissing = computed(() => files.items.some(i => ['remote', 'paused'].includes(i.status)))
const pct = (i: FileItem): number => (i.entry.size ? Math.min(100, Math.round((i.done / i.entry.size) * 100)) : 0)

function pick(): void { input.value?.click() }
function onPick(e: Event): void {
  const el = e.target as HTMLInputElement
  void files.addFiles([...(el.files ?? [])])
  el.value = ''
}
function onDrop(e: DragEvent): void {
  dragging.value = false; dragDepth = 0
  if (e.dataTransfer?.files.length) void files.addFiles([...e.dataTransfer.files])
}
function onPaste(e: ClipboardEvent): void {
  const list = [...(e.clipboardData?.files ?? [])]
  if (list.length) { e.preventDefault(); void files.addFiles(list) }
}
const enter = (e: DragEvent): void => { if (e.dataTransfer?.types.includes('Files')) { dragDepth++; dragging.value = true } }
const leave = (): void => { if (--dragDepth <= 0) { dragging.value = false; dragDepth = 0 } }

onMounted(() => {
  void files.init()
  window.addEventListener('paste', onPaste)
  window.addEventListener('dragenter', enter); window.addEventListener('dragleave', leave)
  window.addEventListener('dragover', e => e.preventDefault()); window.addEventListener('drop', onDrop as EventListener)
})
onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste); window.removeEventListener('dragenter', enter)
  window.removeEventListener('dragleave', leave); window.removeEventListener('drop', onDrop as EventListener)
})
watch(() => app.ready, r => { if (r) void files.init() })

const previewable = (i: FileItem): boolean => i.status === 'complete' && /^(image|video|audio)\/|^application\/pdf$|^text\//.test(i.entry.mime)
async function openPreview(i: FileItem): Promise<void> {
  view.item = i; view.url = ''; view.text = ''
  if (i.entry.mime.startsWith('text/')) view.text = (await files.previewText(i.entry.fileId)) ?? ''
  else view.url = (await files.previewUrl(i.entry.fileId)) ?? ''
}
async function confirmClear(): Promise<void> { if (confirm('Remove all shared files from every device?')) await files.clearAll() }
async function confirmRemove(i: FileItem): Promise<void> { if (confirm(`Remove ${i.entry.name} from every device?`)) await files.remove(i.entry.fileId) }

const label = (i: FileItem): string => {
  switch (i.status) {
    case 'preparing': return i.hashing ? `Preparing ${Math.round((i.hashing / i.entry.size) * 100)}%` : 'Preparing...'
    case 'reselect': return 'Re-select this file to keep sharing it'
    case 'downloading': return `${pct(i)}% · ${fmtBytes(i.speed)}/s · ${i.sources} source${i.sources === 1 ? '' : 's'}${i.speed > 0 ? ` · ${fmtDuration((i.entry.size - i.done) / i.speed)}` : ''}`
    case 'paused': return `Paused at ${pct(i)}%`
    case 'complete': return 'On this device'
    default: return files.holderOnline(i.entry) ? 'Available' : 'Waiting for a device that has it'
  }
}
defineExpose({ pick })
</script>

<template>
  <section v-show="sorted.length || dragging" class="mt-4" aria-label="Shared files">
    <div class="flex items-center gap-2 mb-2 px-1">
      <h2 class="font-semibold">Files <span class="text-muted font-normal">({{ sorted.length }})</span></h2>
      <div class="ml-auto flex gap-1.5">
        <button v-if="anyMissing" class="btn !min-h-9 text-sm" @click="files.downloadMissing()"><Icon name="download" :size="15" /><span class="hidden sm:inline">Get all</span></button>
        <button v-if="anyDone" class="btn !min-h-9 text-sm" @click="files.zipAll()"><Icon name="zip" :size="15" /><span class="hidden sm:inline">Zip all</span></button>
        <button class="btn !min-h-9 text-sm" @click="pick"><Icon name="plus" :size="15" />Add</button>
        <button v-if="sorted.length" class="btn !min-h-9 text-sm" aria-label="Remove all files" @click="confirmClear"><Icon name="trash" :size="15" /></button>
      </div>
    </div>
    <p v-if="!files.opfs" class="text-xs text-muted mb-2 px-1">This browser keeps files in memory only: no resume after reload, 500 MB limit.</p>
    <p v-if="files.blocked" class="text-xs mb-2 px-3 py-2 rounded-lg bg-warn/20 border border-warn/50">Direct connection blocked by your network. Try the same Wi-Fi or enable a relay.</p>

    <ul class="space-y-2">
      <li v-for="i in sorted" :key="i.entry.fileId" class="card p-3 flex items-center gap-3 anim-pop" :data-testid="`file-${i.entry.name}`" :data-status="i.status">
        <img v-if="i.entry.thumb" :src="i.entry.thumb" alt="" class="size-12 rounded-lg object-cover bg-surface-2 shrink-0">
        <span v-else class="size-12 rounded-lg bg-surface-2 grid place-items-center shrink-0 text-muted"><Icon name="file" :size="22" /></span>
        <div class="min-w-0 flex-1">
          <p class="font-medium truncate" :title="i.entry.name">{{ i.entry.name }}</p>
          <p class="text-xs text-muted truncate">{{ fmtBytes(i.entry.size) }} · {{ label(i) }}</p>
          <div v-if="['downloading', 'paused'].includes(i.status) || (i.status === 'preparing' && i.hashing)" class="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" :aria-valuenow="pct(i)">
            <div class="h-full bg-accent transition-[width] duration-200" :style="{ width: `${i.status === 'preparing' ? Math.round((i.hashing / i.entry.size) * 100) : pct(i)}%` }" />
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button v-if="i.status === 'reselect'" class="btn !px-3 text-sm" @click="pick">Select</button>
          <button v-if="i.status === 'remote'" class="btn btn-soft !px-3" :aria-label="`Download ${i.entry.name}`" @click="files.download(i.entry.fileId)"><Icon name="download" :size="17" /></button>
          <button v-if="i.status === 'downloading'" class="btn !px-2.5" aria-label="Pause" @click="files.pause(i.entry.fileId)"><Icon name="pause" :size="17" /></button>
          <button v-if="i.status === 'paused'" class="btn btn-soft !px-2.5" aria-label="Resume" @click="files.resume(i.entry.fileId)"><Icon name="play" :size="17" /></button>
          <button v-if="['downloading', 'paused'].includes(i.status)" class="btn !px-2.5" aria-label="Cancel download" @click="files.cancel(i.entry.fileId)"><Icon name="x" :size="17" /></button>
          <button v-if="previewable(i)" class="btn !px-2.5 hidden sm:inline-flex" aria-label="Preview" @click="openPreview(i)"><Icon name="eye" :size="17" /></button>
          <button v-if="i.status === 'complete'" class="btn btn-soft !px-2.5" :aria-label="`Save ${i.entry.name}`" @click="files.save(i.entry.fileId)"><Icon name="download" :size="17" /></button>
          <button class="btn !px-2.5" :aria-label="`Remove ${i.entry.name}`" @click="confirmRemove(i)"><Icon name="trash" :size="17" /></button>
        </div>
      </li>
    </ul>

    <input ref="input" type="file" multiple class="hidden" data-testid="file-input" @change="onPick">
    <div v-if="dragging" class="fixed inset-0 z-40 bg-accent/10 border-4 border-dashed border-accent grid place-items-center pointer-events-none">
      <p class="card px-6 py-4 text-lg font-semibold">Drop files to share them</p>
    </div>

    <Modal :open="!!view.item" :title="view.item?.entry.name ?? ''" @close="view.item = null">
      <img v-if="view.url && view.item?.entry.mime.startsWith('image/')" :src="view.url" :alt="view.item.entry.name" class="max-h-[70dvh] mx-auto rounded-lg">
      <video v-else-if="view.url && view.item?.entry.mime.startsWith('video/')" :src="view.url" controls playsinline class="w-full rounded-lg max-h-[70dvh]" />
      <audio v-else-if="view.url && view.item?.entry.mime.startsWith('audio/')" :src="view.url" controls class="w-full" />
      <iframe v-else-if="view.url" :src="view.url" class="w-full h-[70dvh] rounded-lg border border-line" title="Preview" />
      <pre v-else-if="view.text" class="whitespace-pre-wrap break-words text-sm font-mono">{{ view.text }}</pre>
    </Modal>
  </section>

</template>
