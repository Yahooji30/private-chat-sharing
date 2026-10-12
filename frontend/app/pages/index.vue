<script setup lang="ts">
import { findUrls } from '~/utils/format'

useAppSeo('home', { title: `${useRuntimeConfig().public.appName}: share text and files across your devices` })
const app = useApp()
const toast = useToast()
const sync = useTextSync()
const ta = useTemplateRef<HTMLTextAreaElement>('ta')
const urlsOpen = ref(false)
const transfer = ref<'upload' | 'download' | null>(null)
const tab = ref<'text' | 'files' | 'devices'>('text')
const peerCount = computed(() => Math.max(app.peers.length, app.online ? 1 : 0))
const fileCount = computed(() => fileStore.items.length)
const deviceIcon: Record<string, string> = { phone: 'phone', tablet: 'tablet', desktop: 'desktop' }
const headline = computed(() => (peerCount.value > 1 ? `${peerCount.value} devices in sync` : 'Just this device for now'))
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
const dock = 'flex-1 flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 min-h-[58px] lg:min-h-12 text-[11px] lg:text-sm font-semibold text-muted hover:text-ink hover:bg-surface-2 transition-colors relative'
const steps = [['Open this page', 'On any device on the same Wi-Fi or network. No sign-up, no install needed.'], ['Type or drop files', 'Text appears everywhere instantly. Files go straight from device to device and are never stored on our servers.'], ['Link other networks', 'Scan a QR code or enter a short code to bring a phone on mobile data into the same space.']]
</script>

<template>
  <div class="pt-3 lg:pt-1 pb-4">
    <ClientOnly>
    <header class="flex items-end gap-3 mb-4">
      <div class="mr-auto min-w-0">
        <p class="eyebrow">Your space</p>
        <h1 class="text-[1.6rem] md:text-3xl font-extrabold truncate">{{ headline }}</h1>
      </div>
      <button class="flex items-center -space-x-2 shrink-0 pb-1" aria-label="Show devices" @click="tab = 'devices'">
        <span v-for="(p, n) in app.peers.slice(0, 4)" :key="p.deviceId" class="size-9 rounded-full grid place-items-center ring-2 ring-bg text-white" :class="p.self ? 'bg-[var(--accent-btn)]' : 'bg-pink'"><Icon :name="deviceIcon[p.type] ?? 'desktop'" :size="16" /></span>
        <span v-if="app.peers.length > 4" class="size-9 rounded-full grid place-items-center ring-2 ring-bg bg-surface-2 text-xs font-bold">+{{ app.peers.length - 4 }}</span>
      </button>
    </header>

    <!-- phone + tablet: the three areas become tabs -->
    <div class="lg:hidden grid grid-cols-3 gap-1 p-1 mb-4 rounded-2xl bg-surface-2" role="tablist" aria-label="Sections">
      <button v-for="t in ([['text', 'Text'], ['files', `Files${fileCount ? ` (${fileCount})` : ''}`], ['devices', `Devices (${peerCount})`]] as const)" :key="t[0]" role="tab" :aria-selected="tab === t[0]"
        class="h-10 rounded-xl text-sm font-bold transition" :class="tab === t[0] ? 'bg-surface text-ink shadow-card' : 'text-muted'" @click="tab = t[0]">{{ t[1] }}</button>
    </div>

    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 items-start">
      <!-- scratchpad -->
      <section :class="tab === 'text' ? '' : 'hidden lg:block'" aria-label="Shared text">
        <div class="card overflow-hidden !rounded-[26px] border-l-[5px] border-l-[var(--blue)] border-r-[5px] border-r-[var(--pink)]">
          <div class="flex items-center gap-2 px-5 pt-4">
            <span class="eyebrow">Scratchpad</span>
            <span class="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold" :class="sync.state.value === 'offline' ? 'text-warn' : 'text-muted'">
              <span class="size-2 rounded-full" :class="sync.state.value === 'offline' ? 'bg-warn' : sync.state.value === 'saving' ? 'bg-muted animate-pulse' : 'bg-ok'" />{{ statusText }}<span v-if="sync.savedAt.value" class="font-normal"> · {{ fmtAgo(sync.savedAt.value, now) }}</span>
            </span>
            <button class="size-8 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Reload from server" @click="sync.load()"><Icon name="refresh" :size="16" /></button>
          </div>
          <div class="relative">
            <textarea ref="ta" :value="sync.text.value" :class="fontClass" :style="{ fontSize: `${app.settings.fontSize}px` }" :spellcheck="app.spellcheck"
              class="block w-full h-[44dvh] md:h-[48dvh] lg:h-[50dvh] min-h-60 resize-none bg-transparent px-5 py-3 outline-none leading-relaxed"
              placeholder="Type or paste here. It shows up on all your devices instantly." aria-label="Shared text" autocapitalize="sentences" @input="sync.edit(($event.target as HTMLTextAreaElement).value)" />
            <span v-if="sync.text.value.length > 95000" class="absolute bottom-2 right-4 text-xs" :class="sync.tooBig.value ? 'text-accent-ink font-semibold' : 'text-muted'">{{ sync.text.value.length.toLocaleString() }} / 100,000</span>
          </div>
          <UrlsPanel v-if="urlsOpen && urls.length" :urls="urls" :new-tab="app.settings.urlsNewTab" @close="urlsOpen = false" />
          <div class="flex border-t border-line divide-x divide-line" role="toolbar" aria-label="Text actions">
            <button :class="dock" aria-label="Copy" @click="copy"><Icon name="copy" :size="19" />Copy</button>
            <button v-if="app.settings.urlsPanel" :class="[dock, urlsOpen ? '!text-accent-ink bg-accent-soft' : '']" aria-label="URLs" :aria-pressed="urlsOpen" @click="urlsOpen = !urlsOpen">
              <Icon name="link" :size="19" />Links<span v-if="urls.length" class="absolute top-1.5 left-1/2 ml-2 lg:static lg:ml-0 text-[10px] lg:text-xs font-bold bg-[var(--accent-btn)] text-white rounded-full px-1.5 min-w-4 text-center">{{ urls.length }}</span></button>
            <button :class="dock" aria-label="Upload files" @click="transfer = 'upload'"><Icon name="upload" :size="19" />Upload</button>
            <button :class="dock" aria-label="Downloads" @click="transfer = 'download'"><Icon name="download" :size="19" />Download<span v-if="downloadCount" class="absolute top-1.5 left-1/2 ml-2 lg:static lg:ml-0 text-[10px] lg:text-xs font-bold bg-pink text-white rounded-full px-1.5 min-w-4 text-center" data-testid="download-count">{{ downloadCount }}</span></button>
            <button :class="dock" @click="clear"><Icon name="trash" :size="19" />Clear</button>
          </div>
        </div>
        <AdSlot kind="inline" class="mt-5 lg:hidden" />
      </section>

      <!-- side column: files and devices -->
      <div class="space-y-5 lg:mt-0">
        <div :class="tab === 'files' ? '' : 'hidden lg:block'"><FilesPanel ref="files" /></div>

        <section :class="tab === 'devices' ? '' : 'hidden lg:block'" aria-label="Devices">
          <div class="flex items-center gap-2 mb-2 px-1"><h2 class="font-bold text-base">Devices</h2><span class="chip">{{ peerCount }} online</span></div>
          <ul class="card divide-y divide-line">
            <li v-for="p in app.peers" :key="p.deviceId" class="flex items-center gap-3 px-4 py-3">
              <span class="size-10 rounded-2xl grid place-items-center text-white shrink-0" :class="p.self ? 'bg-[var(--accent-btn)]' : 'bg-pink'"><Icon :name="deviceIcon[p.type] ?? 'desktop'" :size="19" /></span>
              <div class="min-w-0"><p class="font-semibold truncate leading-tight">{{ p.name }}</p><p class="text-xs text-muted">{{ p.self ? 'This device' : 'Connected' }}</p></div>
              <span class="ml-auto size-2 rounded-full bg-ok" />
            </li>
            <li v-if="!app.peers.length" class="px-4 py-4 text-sm text-muted">Only you right now. Open this page on another device to see it here.</li>
          </ul>
          <button class="btn btn-accent w-full mt-3 !min-h-12" @click="app.openSettings('link')"><Icon name="link" :size="17" />Link another device</button>
        </section>

        <AdSlot kind="inline" class="hidden lg:block" />
      </div>
    </div>

    <TransferModal :open="!!transfer" :mode="transfer ?? 'upload'" @close="transfer = null" @pick="files?.pick()" @save-text="download(); transfer = null" />

    <section class="mt-12 max-w-4xl mx-auto px-1" aria-labelledby="how">
      <p class="eyebrow text-center">How it works</p>
      <h2 id="how" class="text-2xl md:text-3xl font-extrabold text-center mt-2">Three steps, no sign-up</h2>
      <ol class="mt-7 grid md:grid-cols-3 gap-x-8 gap-y-6">
        <li v-for="(st, n) in steps" :key="n" class="flex md:block gap-4"><span class="font-extrabold text-5xl leading-none shrink-0 w-14 md:w-auto" :class="n === 1 ? 'text-pink' : 'text-[var(--blue)]'">0{{ n + 1 }}</span>
          <div class="md:mt-3"><strong class="text-base">{{ st[0] }}</strong><p class="text-muted mt-1 text-sm leading-relaxed">{{ st[1] }}</p></div></li>
      </ol>
      <AdSlot kind="banner" class="mt-10" />
      <p class="text-center text-sm text-muted mt-8">Need privacy? <NuxtLink to="/chat" class="text-accent-ink font-bold underline">Start an encrypted chat room</NuxtLink> that disappears when everyone leaves. Anyone on your network shares the space, so avoid putting secrets in the shared text on public Wi-Fi.</p>
    </section>

    <template #fallback>
      <div aria-hidden="true"><div class="h-12 w-60 rounded-xl bg-surface-2 mb-4" /><div class="h-[44dvh] min-h-60 rounded-[26px] bg-surface border border-line" /></div>
    </template>
    </ClientOnly>
  </div>
</template>
