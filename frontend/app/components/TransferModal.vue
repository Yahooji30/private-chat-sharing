<script setup lang="ts">
import type { FileItem } from '~/stores/files'
import { fmtBytes } from '~/utils/format'

const props = defineProps<{ open: boolean; mode: 'upload' | 'download' }>()
const emit = defineEmits<{ close: []; pick: []; 'save-text': [] }>()
const files = useFiles()
const dragOver = ref(false)

const downloadable = computed(() => files.items.filter(i => ['remote', 'downloading', 'paused', 'complete'].includes(i.status)))
const uploading = computed(() => files.items.filter(i => ['preparing', 'reselect'].includes(i.status)))
const pending = computed(() => files.items.filter(i => ['remote', 'paused'].includes(i.status)))
const pct = (i: FileItem): number => (i.entry.size ? Math.min(100, Math.round((i.done / i.entry.size) * 100)) : 0)
const hashPct = (i: FileItem): number => (i.entry.size ? Math.round((i.hashing / i.entry.size) * 100) : 0)

function drop(e: DragEvent): void {
  dragOver.value = false
  if (e.dataTransfer?.files.length) void files.addFiles([...e.dataTransfer.files])
}
const state = (i: FileItem): string => {
  if (i.status === 'complete') return 'On this device'
  if (i.status === 'downloading') return i.speed > 0 ? `${pct(i)}% · ${fmtBytes(i.speed)}/s` : `${pct(i)}% · waiting for a source`
  if (i.status === 'paused') return `Paused at ${pct(i)}%`
  return files.holderOnline(i.entry) ? 'Ready to download' : 'Waiting for a device that has it'
}
watch(() => props.open, () => { dragOver.value = false })
</script>

<template>
  <Modal :open="open" :title="mode === 'upload' ? 'Upload files' : `Download (${downloadable.length})`" :subtitle="mode === 'upload' ? 'Files go straight to your other devices. Nothing is stored on a server.' : 'Files shared by your devices'" @close="emit('close')">
    <template v-if="mode === 'upload'">
      <button class="w-full rounded-2xl border-2 border-dashed px-4 py-10 text-center transition" :class="dragOver ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:border-accent'"
        @click="emit('pick')" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="drop">
        <span class="mx-auto size-12 rounded-2xl bg-accent-soft text-accent-ink grid place-items-center mb-3"><Icon name="upload" :size="24" /></span>
        <span class="block font-semibold">Choose files or drop them here</span>
        <span class="block text-sm text-muted mt-1">You can also paste an image or file anywhere on the page</span>
      </button>
      <ul v-if="uploading.length" class="mt-4 space-y-2">
        <li v-for="i in uploading" :key="i.entry.fileId" class="card p-3">
          <div class="flex items-center gap-2 text-sm"><span class="truncate font-medium flex-1">{{ i.entry.name }}</span><span class="text-muted shrink-0">{{ fmtBytes(i.entry.size) }}</span></div>
          <p class="text-xs text-muted mt-0.5">{{ i.status === 'reselect' ? 'Select this file again to keep sharing it' : `Preparing ${hashPct(i)}%` }}</p>
          <div v-if="i.status === 'preparing'" class="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden"><div class="h-full bg-accent transition-[width] duration-200" :style="{ width: `${hashPct(i)}%` }" /></div>
        </li>
      </ul>
      <p class="text-xs text-muted mt-4">{{ files.items.length }} file{{ files.items.length === 1 ? '' : 's' }} shared in this space</p>
    </template>

    <template v-else>
      <p v-if="!downloadable.length" class="text-center text-muted py-8">No files yet. Upload one from any device.</p>
      <ul v-else class="space-y-2">
        <li v-for="i in downloadable" :key="i.entry.fileId" class="card p-3 flex items-center gap-3">
          <img v-if="i.entry.thumb" :src="i.entry.thumb" alt="" class="size-11 rounded-lg object-cover bg-surface-2 shrink-0">
          <span v-else class="size-11 rounded-lg bg-surface-2 grid place-items-center shrink-0 text-muted"><Icon name="file" :size="20" /></span>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate">{{ i.entry.name }}</p>
            <p class="text-xs text-muted truncate">{{ fmtBytes(i.entry.size) }} · {{ state(i) }}</p>
            <div v-if="['downloading', 'paused'].includes(i.status)" class="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden"><div class="h-full bg-accent transition-[width] duration-200" :style="{ width: `${pct(i)}%` }" /></div>
          </div>
          <button v-if="i.status === 'remote'" class="btn btn-soft !px-3" :aria-label="`Download ${i.entry.name}`" @click="files.download(i.entry.fileId)"><Icon name="download" :size="17" /></button>
          <button v-else-if="i.status === 'downloading'" class="btn !px-2.5" aria-label="Pause" @click="files.pause(i.entry.fileId)"><Icon name="pause" :size="17" /></button>
          <button v-else-if="i.status === 'paused'" class="btn btn-soft !px-2.5" aria-label="Resume" @click="files.resume(i.entry.fileId)"><Icon name="play" :size="17" /></button>
          <button v-else class="btn btn-soft !px-2.5" :aria-label="`Save ${i.entry.name}`" @click="files.save(i.entry.fileId)"><Icon name="download" :size="17" /></button>
        </li>
      </ul>
      <div class="flex flex-wrap gap-2 mt-4">
        <button v-if="pending.length" class="btn btn-accent flex-1" @click="files.downloadMissing()"><Icon name="download" :size="16" />Get all ({{ pending.length }})</button>
        <button class="btn flex-1" @click="emit('save-text')"><Icon name="file" :size="16" />Save text as .txt</button>
      </div>
    </template>
  </Modal>
</template>
