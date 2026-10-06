<script setup lang="ts">
import { findUrls } from '~/utils/format'

useHead({ title: `${useRuntimeConfig().public.appName}: share text and files across your devices` })
const app = useApp()
const toast = useToast()
const sync = useTextSync()
const ta = useTemplateRef<HTMLTextAreaElement>('ta')
const urlsOpen = ref(false)
const transfer = ref<'upload' | 'download' | null>(null)
const fileStore = useFiles()
const downloadCount = computed(() => fileStore.items.filter(i => ['remote', 'downloading', 'paused'].includes(i.status)).length)
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval>
onBeforeUnmount(() => clearInterval(tick))

const urls = computed(() => (app.settings.urlsPanel ? findUrls(sync.text.value) : []))
watch(() => urls.value.length, (n, o) => { if (n > 0 && o === 0 && app.settings.urlsAutoExpand) urlsOpen.value = true; if (n === 0) urlsOpen.value = false })
const fontClass = computed(() => ({ sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' })[app.settings.fontFamily])
const statusText = computed(() => ({ idle: 'Start typing...', saving: 'Saving...', saved: sync.text.value ? 'Saved' : 'Start typing...', offline: 'Offline' })[sync.state.value])

onMounted(async () => {
  tick = setInterval(() => { now.value = Date.now() }, 15_000)
  sync.bind(() => ta.value)
  try { await sync.load() } catch { sync.state.value = 'offline' }
  const q = useRoute().query
  if (q.share) { const t = [q.title, q.text, q.url].filter(Boolean).join('\n'); if (t) sync.edit(sync.text.value ? `${sync.text.value}\n${t}` : t); history.replaceState(null, '', '/') }
})

async function copy(): Promise<void> {
  if (!sync.text.value) return toast.warn('Nothing to copy yet')
  if (await copyText(sync.text.value)) toast.ok('Copied'); else toast.err('Copy failed')
}
function download(): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([sync.text.value], { type: 'text/plain' }))
  a.download = 'text.txt'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function clear(): void {
  if (!sync.text.value || !confirm('Clear all text on every linked device?')) return
  sync.edit('')
}
const files = useTemplateRef<{ pick: () => void }>('files')
const btn = 'btn !px-3'
</script>

<template>
  <div class="pt-2 md:pt-3">
    <ClientOnly>
    <div class="flex items-center gap-3 mb-3 flex-wrap">
      <div class="flex items-center gap-2 mr-auto min-w-0">
        <h1 class="text-lg md:text-xl text-ink/80 truncate" :class="sync.state.value === 'offline' ? 'text-accent-ink' : ''">{{ statusText }}</h1>
        <Icon :name="sync.state.value === 'offline' ? 'alert' : 'checkCircle'" :size="22" :class="sync.state.value === 'saving' ? 'text-muted animate-pulse' : sync.state.value === 'offline' ? 'text-warn' : 'text-ok'" />
      </div>
      <div class="flex gap-1.5 md:gap-2 w-full sm:w-auto" role="toolbar" aria-label="Text actions">
        <button :class="btn" class="flex-1 sm:flex-none" aria-label="Copy" @click="copy"><Icon name="copy" :size="17" /><span class="hidden sm:inline">Copy</span></button>
        <button v-if="app.settings.urlsPanel" :class="[btn, urlsOpen ? 'btn-soft' : '']" class="flex-1 sm:flex-none" aria-label="URLs" :aria-pressed="urlsOpen" @click="urlsOpen = !urlsOpen">
          <Icon name="link" :size="17" /><span class="hidden sm:inline">URLs</span><span v-if="urls.length" class="text-xs bg-[var(--accent-btn)] text-white rounded-full px-1.5 min-w-5 text-center">{{ urls.length }}</span></button>
        <button :class="btn" class="flex-1 sm:flex-none" aria-label="Upload files" @click="transfer = 'upload'"><Icon name="upload" :size="17" /><span class="hidden sm:inline">Upload</span></button>
        <button :class="btn" class="flex-1 sm:flex-none" aria-label="Downloads" @click="transfer = 'download'"><Icon name="download" :size="17" /><span class="hidden sm:inline">Download</span><span v-if="downloadCount" class="text-xs bg-[var(--accent-btn)] text-white rounded-full px-1.5 min-w-5 text-center" data-testid="download-count">{{ downloadCount }}</span></button>
        <button :class="btn" class="!px-2.5" aria-label="Reload from server" @click="sync.load()"><Icon name="refresh" :size="17" /></button>
      </div>
    </div>

    <UrlsPanel v-if="urlsOpen && urls.length" :urls="urls" :new-tab="app.settings.urlsNewTab" @close="urlsOpen = false" />

    <div class="relative">
      <textarea ref="ta" :value="sync.text.value" :class="fontClass" :style="{ fontSize: `${app.settings.fontSize}px` }" :spellcheck="app.spellcheck"
        class="block w-full h-[46dvh] md:h-[52dvh] min-h-60 resize-y p-5 md:p-7 rounded-2xl bg-surface border border-line outline-none leading-relaxed transition focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_16%,transparent)]"
        placeholder="Type or paste here. It shows up on all your devices instantly." aria-label="Shared text" autocapitalize="sentences" @input="sync.edit(($event.target as HTMLTextAreaElement).value)" />
      <span v-if="sync.text.value.length > 95000" class="absolute bottom-3 right-4 text-xs" :class="sync.tooBig.value ? 'text-accent-ink font-semibold' : 'text-muted'">{{ sync.text.value.length.toLocaleString() }} / 100,000</span>
    </div>
    <div class="flex items-center justify-between px-1 py-2 text-sm text-muted">
      <span class="inline-flex items-center gap-1.5"><Icon name="checkCircle" :size="16" class="text-ok" />{{ sync.savedAt.value ? fmtAgo(sync.savedAt.value, now) : '--' }}</span>
      <button class="hover:text-ink px-3 min-h-10" @click="clear">Clear</button>
    </div>

    <FilesPanel ref="files" />
    <TransferModal :open="!!transfer" :mode="transfer ?? 'upload'" @close="transfer = null" @pick="files?.pick()" @save-text="download(); transfer = null" />

    <div id="ad-top-banner" class="min-h-0" />
    <template #fallback>
      <div aria-hidden="true"><div class="h-[92px] sm:h-[52px] mb-0 flex items-start"><div class="h-8 w-40 rounded-lg bg-surface-2" /></div><div class="h-[46dvh] md:h-[52dvh] min-h-60 rounded-2xl bg-surface border border-line" /><div class="h-14" /></div>
    </template>
    </ClientOnly>

    <section class="mt-10 max-w-3xl mx-auto px-1" aria-labelledby="how">
      <h2 id="how" class="text-2xl font-bold tracking-tight text-center">Share between your devices in three steps</h2>
      <ol class="mt-5 grid sm:grid-cols-3 gap-3 text-sm">
        <li class="card p-4"><span class="size-8 rounded-full bg-accent-soft text-accent-ink grid place-items-center font-bold mb-2">1</span><strong>Open this page</strong><p class="text-muted mt-1">On any device on the same Wi-Fi or network. No sign-up, no install needed.</p></li>
        <li class="card p-4"><span class="size-8 rounded-full bg-accent-soft text-accent-ink grid place-items-center font-bold mb-2">2</span><strong>Type or drop files</strong><p class="text-muted mt-1">Text appears everywhere instantly. Files go straight from device to device and are never stored on our servers.</p></li>
        <li class="card p-4"><span class="size-8 rounded-full bg-accent-soft text-accent-ink grid place-items-center font-bold mb-2">3</span><strong>Link other networks</strong><p class="text-muted mt-1">Scan a QR code or enter a short code to bring a phone on mobile data into the same space.</p></li>
      </ol>
      <p class="text-center text-sm text-muted mt-5">Need privacy? <NuxtLink to="/chat" class="text-accent-ink underline">Start an encrypted chat room</NuxtLink> that disappears when everyone leaves. Anyone on your network shares the space, so avoid putting secrets in the shared text on public Wi-Fi.</p>
    </section>
  </div>
</template>
