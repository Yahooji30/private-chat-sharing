<script setup lang="ts">
import { isThumb } from '@sync/shared'
import type { FileItem } from '~/stores/files'
import { fmtBytes, fmtDuration } from '~/utils/format'

/** `bare`: inside a pop-up that already has the title, so the panel does not repeat it */
defineProps<{ bare?: boolean }>()

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
const toast = useToast()
const isMac = import.meta.client && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
const pasteKey = isMac ? '⌘V' : 'Ctrl+V'
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' }
const stamp = (): string => new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
/** a screenshot or copied picture arrives called "image.png": give each its own name so pastes do not look the same */
function named(f: File, i: number): File {
  if (!/^image\.\w+$/i.test(f.name)) return f
  return new File([f], `pasted-image-${stamp()}${i ? `-${i + 1}` : ''}.${f.name.split('.').pop()}`, { type: f.type })
}
function onPaste(e: ClipboardEvent): void {
  const list = [...(e.clipboardData?.files ?? [])].map(named)
  if (list.length) { e.preventDefault(); void files.addFiles(list) }
}
/** The Paste button: for phones and for anyone who would rather click than press keys. Reads files and pictures from the clipboard. */
async function pasteFromClipboard(): Promise<void> {
  if (!navigator.clipboard?.read) return toast.warn(`This browser cannot paste from a button. Press ${pasteKey} instead.`)
  try {
    const out: File[] = []
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find(t => !t.startsWith('text/'))
      if (!type) continue
      const blob = await item.getType(type)
      out.push(new File([blob], `pasted-${type.startsWith('image/') ? 'image' : 'file'}-${stamp()}${out.length ? `-${out.length + 1}` : ''}.${EXT[type] ?? 'bin'}`, { type }))
    }
    if (!out.length) return toast.warn('Nothing to paste. Copy a picture or a file first.')
    await files.addFiles(out)
  } catch { toast.warn(`Allow clipboard access to paste, or press ${pasteKey}.`) }
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
async function confirmClear(): Promise<void> { if (await confirmDialog('Remove all files?', 'Every shared file is removed from all of your devices.', { confirmLabel: 'Remove all' })) await files.clearAll() }
async function confirmRemove(i: FileItem): Promise<void> { if (await confirmDialog('Remove this file?', `${i.entry.name} is removed from every device.`, { confirmLabel: 'Remove' })) await files.remove(i.entry.fileId) }

const label = (i: FileItem): string => {
  switch (i.status) {
    case 'preparing': return i.hashing ? `Preparing ${Math.round((i.hashing / i.entry.size) * 100)}%` : 'Preparing...'
    case 'reselect': return 'Re-select this file to keep sharing it'
    case 'downloading': return `${pct(i)}% · ${i.speed > 0 ? `${fmtBytes(i.speed)}/s · ` : ''}${i.sources ? `${i.sources} source${i.sources === 1 ? '' : 's'}` : 'looking for the other device, keep it open'}${i.speed > 0 ? ` · ${fmtDuration((i.entry.size - i.done) / i.speed)}` : ''}`
    case 'paused': return `Paused at ${pct(i)}%`
    case 'complete': return 'On this device'
    default: return files.holderOnline(i.entry) ? 'Available' : 'Waiting for a device that has it'
  }
}
const ext = (n: string): string => (n.includes('.') ? n.split('.').pop()!.slice(0, 4).toUpperCase() : 'FILE')
const warm = (m: string): boolean => /^(image|video)\//.test(m)
defineExpose({ pick })
</script>

<template>
  <section aria-label="Shared files">
    <div class="flex items-center gap-2 mb-2 px-1">
      <template v-if="!bare"><h2 class="font-semibold text-base">Files</h2><span v-if="sorted.length" class="chip">{{ sorted.length }}</span></template>
      <div class="ml-auto flex gap-1.5">
        <button v-if="anyMissing" class="btn !min-h-9 !px-2.5 text-sm" aria-label="Get all" @click="files.downloadMissing()"><Icon name="download" :size="15" /><span class="hidden sm:inline">Get all</span></button>
        <button v-if="anyDone" class="btn !min-h-9 !px-2.5 text-sm" aria-label="Zip all" @click="files.zipAll()"><Icon name="zip" :size="15" /><span class="hidden sm:inline">Zip</span></button>
        <button v-if="sorted.length" class="btn !min-h-9 !px-2.5 text-sm" aria-label="Remove all files" @click="confirmClear"><Icon name="trash" :size="15" /></button>
      </div>
    </div>
    <p v-if="!files.opfs" class="text-xs text-muted mb-2 px-1">This browser keeps files in memory only: no resume after reload, 500 MB limit.</p>
    <p v-if="files.blocked" class="text-xs mb-2 px-3 py-2 rounded-xl bg-warn/20 border border-warn/50">Direct connection blocked by your network. Try the same Wi-Fi or enable a relay.</p>

    <button class="w-full rounded-2xl border border-dashed px-4 text-center transition-colors" :class="[dragging ? 'border-[var(--accent)] bg-accent-soft' : 'border-[color-mix(in_srgb,var(--text)_22%,var(--line))] hover:border-[var(--accent)] hover:bg-accent-soft/50', sorted.length ? 'py-3 mb-3' : 'py-8']" @click="pick">
      <span class="inline-flex items-center gap-2 font-semibold text-sm" :class="sorted.length ? 'text-accent-ink' : 'text-ink'"><Icon name="plus" :size="16" />{{ sorted.length ? 'Add more files' : 'Drop files here or tap to choose' }}</span>
      <span v-if="!sorted.length" class="block text-xs text-muted mt-1">Sent straight to your other devices. Nothing is stored on a server.</span>
    </button>
    <!-- the clipboard button and its hint are for computers; on a phone the box above (or the share sheet) is the way to add files -->
    <div class="hidden md:flex items-center gap-2 px-1" :class="sorted.length ? '-mt-1 mb-3' : 'mt-2 mb-3'">
      <p class="hidden md:flex items-center gap-1.5 text-xs text-muted" data-testid="paste-hint"><kbd class="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">{{ pasteKey }}</kbd>to paste a copied file or screenshot</p>
      <button class="btn !min-h-9 !px-3 text-sm ml-auto" data-testid="paste-files" @click="pasteFromClipboard"><Icon name="paste" :size="15" />Paste</button>
    </div>

    <ul class="space-y-2">
      <li v-for="i in sorted" :key="i.entry.fileId" class="card !rounded-2xl p-3 flex items-center gap-3 anim-pop" :data-testid="`file-${i.entry.name}`" :data-status="i.status">
        <img v-if="isThumb(i.entry.thumb)" :src="i.entry.thumb" alt="" class="size-11 rounded-xl object-cover bg-surface-2 shrink-0">
        <span v-else class="size-11 rounded-xl grid place-items-center shrink-0 text-[11px] font-semibold tracking-wide" :class="warm(i.entry.mime) ? 'bg-pink-soft text-pink-ink' : 'bg-accent-soft text-accent-ink'">{{ ext(i.entry.name) }}</span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold truncate leading-tight" :title="i.entry.name">{{ i.entry.name }}</p>
          <p class="text-xs text-muted truncate mt-0.5">{{ fmtBytes(i.entry.size) }} · {{ label(i) }}</p>
          <div v-if="['downloading', 'paused'].includes(i.status) || (i.status === 'preparing' && i.hashing)" class="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" :aria-valuenow="pct(i)">
            <div class="h-full bg-[var(--accent)] transition-[width] duration-200" :style="{ width: `${i.status === 'preparing' ? Math.round((i.hashing / i.entry.size) * 100) : pct(i)}%` }" />
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button v-if="i.status === 'reselect'" class="btn !px-3 text-sm" @click="pick">Select</button>
          <button v-if="i.status === 'remote'" class="btn btn-soft !px-3" :aria-label="`Download ${i.entry.name}`" @click="files.download(i.entry.fileId)"><Icon name="download" :size="17" /></button>
          <button v-if="i.status === 'downloading' && !i.sources" class="btn btn-soft !px-2.5" :aria-label="`Try again: ${i.entry.name}`" title="Look for the other device again" @click="files.retry(i.entry.fileId)"><Icon name="refresh" :size="17" /></button>
          <button v-if="i.status === 'downloading' && i.sources" class="btn !px-2.5" aria-label="Pause" @click="files.pause(i.entry.fileId)"><Icon name="pause" :size="17" /></button>
          <button v-if="i.status === 'paused'" class="btn btn-soft !px-2.5" aria-label="Resume" @click="files.resume(i.entry.fileId)"><Icon name="play" :size="17" /></button>
          <button v-if="['downloading', 'paused'].includes(i.status)" class="btn !px-2.5" aria-label="Cancel download" @click="files.cancel(i.entry.fileId)"><Icon name="x" :size="17" /></button>
          <button v-if="previewable(i)" class="btn !px-2.5 hidden sm:inline-flex" aria-label="Preview" @click="openPreview(i)"><Icon name="eye" :size="17" /></button>
          <button v-if="i.status === 'complete'" class="btn btn-soft !px-2.5" :aria-label="`Save ${i.entry.name}`" @click="files.save(i.entry.fileId)"><Icon name="download" :size="17" /></button>
          <button class="btn !px-2.5" :aria-label="`Remove ${i.entry.name}`" @click="confirmRemove(i)"><Icon name="trash" :size="17" /></button>
        </div>
      </li>
    </ul>

    <input ref="input" type="file" multiple class="hidden" data-testid="file-input" @change="onPick">
    <div v-if="dragging" class="fixed inset-0 z-40 bg-[var(--accent)]/10 border-4 border-dashed border-[var(--accent)] grid place-items-center pointer-events-none">
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
