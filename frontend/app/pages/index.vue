<script setup lang="ts">
import { findUrls } from '~/utils/format'

useAppSeo('home', { title: `${useRuntimeConfig().public.appName}: share text and files across your devices` })
const app = useApp()
const toast = useToast()
const sync = useTextSync()
const ta = useTemplateRef<HTMLTextAreaElement>('ta')
const isDesktop = useMediaQuery('(min-width: 1024px)')
const sheet = ref<'links' | 'files' | null>(null) // phone + tablet: links and files open as pop-up sheets
const peerCount = computed(() => Math.max(app.peers.length, app.online ? 1 : 0))
const fileStore = useFiles()
const fileCount = computed(() => fileStore.items.length)
const headline = computed(() => (peerCount.value > 1 ? `${peerCount.value} devices in sync` : 'Just this device for now'))
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval>
onBeforeUnmount(() => clearInterval(tick))

const urls = computed(() => (app.settings.urlsPanel ? findUrls(sync.text.value) : []))
const fontClass = computed(() => ({ sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' })[app.settings.fontFamily])
const statusText = computed(() => ({ idle: 'Start typing...', saving: 'Saving...', saved: sync.text.value ? 'Saved' : 'Start typing...', offline: 'Offline' })[sync.state.value])

onMounted(async () => {
  tick = setInterval(() => { now.value = Date.now() }, 15_000)
  void fileStore.init()
  sync.bind(() => ta.value)
  try { await sync.load() } catch { sync.state.value = 'offline' }
  const q = useRoute().query
  if (q.share) { const t = [q.title, q.text, q.url].filter(Boolean).join('\n'); if (t) sync.edit(sync.text.value ? `${sync.text.value}\n${t}` : t); history.replaceState(null, '', '/') }
})

async function paste(): Promise<void> {
  let clip = ''
  try { clip = await navigator.clipboard.readText() } catch { return toast.warn('Allow clipboard access, or press Ctrl+V in the box') }
  if (!clip) return toast.warn('Clipboard is empty')
  const el = ta.value, cur = sync.text.value
  const at = el?.selectionStart ?? cur.length, end = el?.selectionEnd ?? cur.length
  sync.edit(cur.slice(0, at) + clip + cur.slice(end))
  toast.ok('Pasted')
  await nextTick()
  el?.focus(); el?.setSelectionRange(at + clip.length, at + clip.length)
}
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
const dock = 'flex-1 min-w-0 flex items-center justify-center gap-2 min-h-12 text-sm font-medium text-muted hover:text-ink hover:bg-surface-2 transition-colors'
const len = computed(() => sync.text.value.length)
const meter = computed(() => (len.value >= app.textMax ? 'text-pink-ink font-semibold' : len.value >= app.textMax * 0.9 ? 'text-warn font-semibold' : 'text-muted'))
const showLinks = computed(() => app.settings.urlsPanel)
const steps = [
  { icon: 'devices', title: 'Open Jodbox on your devices', text: 'Use the same Wi-Fi or network and they find each other. No sign-up, nothing to install.' },
  { icon: 'files', title: 'Type, paste or drop files', text: 'Text appears everywhere instantly. Files go straight from device to device and are never stored on our servers.' },
  { icon: 'qr', title: 'Link other networks', text: 'Scan a QR code or enter a short code to bring a phone on mobile data into the same space.' },
]
</script>

<template>
  <div class="pt-3 lg:pt-1 pb-4">
    <ClientOnly>
    <header class="mb-4">
      <p class="eyebrow">Your space</p>
      <h1 class="text-2xl md:text-[1.75rem] font-semibold mt-0.5">{{ headline }}</h1>
    </header>

    <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-stretch">
      <!-- scratchpad: on a computer it grows to the height of the side column, so there is never a gap under it -->
      <section class="lg:flex lg:flex-col" aria-label="Shared text">
        <!-- phone + tablet: found links and files open as pop-up sheets, right under the title so they are never below the fold -->
        <div class="lg:hidden flex gap-2 mb-3">
          <button v-if="showLinks" class="btn flex-1 !min-h-11" aria-label="Show found links" @click="sheet = 'links'"><Icon name="link" :size="18" />Links<span v-if="urls.length" class="chip">{{ urls.length }}</span></button>
          <button class="btn flex-1 !min-h-11" aria-label="Show files" @click="sheet = 'files'"><Icon name="files" :size="18" />Files<span v-if="fileCount" class="chip chip-pink">{{ fileCount }}</span></button>
        </div>
        <div class="card overflow-hidden flex flex-col lg:flex-1 transition-[border-color,box-shadow] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_16%,transparent)]">
          <div class="flex items-center gap-3 px-5 pt-4">
            <span class="eyebrow">Scratchpad</span>
            <span class="ml-auto text-xs tabular-nums" :class="meter" data-testid="char-count" :title="`Limit: ${app.textMax.toLocaleString()} characters`">{{ len.toLocaleString() }} / {{ app.textMax.toLocaleString() }}</span>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium" :class="sync.state.value === 'offline' ? 'text-warn' : 'text-muted'">
              <span class="size-2 rounded-full" :class="sync.state.value === 'offline' ? 'bg-warn' : sync.state.value === 'saving' ? 'bg-muted animate-pulse' : 'bg-ok'" />{{ statusText }}<span v-if="sync.savedAt.value" class="hidden sm:inline font-normal"> · {{ fmtAgo(sync.savedAt.value, now) }}</span>
            </span>
            <button class="size-8 -mr-1.5 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Reload from server" @click="sync.load()"><Icon name="refresh" :size="17" /></button>
          </div>
          <textarea ref="ta" :value="sync.text.value" :class="fontClass" :style="{ fontSize: `${app.settings.fontSize}px` }" :spellcheck="app.spellcheck"
            class="block w-full flex-none h-[46dvh] md:h-[54dvh] min-h-64 lg:h-auto lg:flex-1 lg:min-h-[28rem] resize-none bg-transparent px-5 py-3 outline-none leading-[1.7]"
            placeholder="Type or paste here. It shows up on all your devices instantly." aria-label="Shared text" autocapitalize="sentences" @input="sync.edit(($event.target as HTMLTextAreaElement).value)" />
          <div class="flex border-t border-line divide-x divide-line" role="toolbar" aria-label="Text actions">
            <button :class="dock" aria-label="Copy" @click="copy"><Icon name="copy" :size="19" />Copy</button>
            <button :class="dock" aria-label="Paste" @click="paste"><Icon name="paste" :size="19" />Paste</button>
            <button :class="dock" aria-label="Save as text file" @click="download"><Icon name="download" :size="19" /><span class="hidden sm:inline">Save .txt</span><span class="sm:hidden">Save</span></button>
            <button :class="dock" @click="clear"><Icon name="trash" :size="19" />Clear</button>
          </div>
        </div>

        <AdSlot kind="inline" class="mt-5 lg:hidden" />
      </section>

      <!-- computer: found links and files sit beside the text -->
      <div v-if="isDesktop" class="space-y-5">
        <section v-if="showLinks && urls.length" aria-label="Found URLs"><UrlsPanel :urls="urls" :new-tab="app.settings.urlsNewTab" /></section>
        <FilesPanel ref="files" />
        <AdSlot kind="inline" />
      </div>
    </div>

    <Modal :open="!isDesktop && sheet === 'links'" title="Found URLs" subtitle="Links detected in your text" @close="sheet = null"><UrlsPanel :urls="urls" :new-tab="app.settings.urlsNewTab" bare /></Modal>
    <Modal :open="!isDesktop && sheet === 'files'" title="Files" subtitle="Shared straight between your devices" @close="sheet = null"><FilesPanel v-if="!isDesktop && sheet === 'files'" /></Modal>

    <section class="mt-14 max-w-5xl mx-auto px-1" aria-labelledby="how">
      <div class="text-center"><span class="chip">How it works</span>
        <h2 id="how" class="text-2xl md:text-3xl font-semibold mt-3">Synced in three simple steps</h2>
        <p class="text-muted mt-2 max-w-xl mx-auto">No account, no setup, no cables. Open it, type, and your other devices are already up to date.</p></div>
      <ol class="mt-8 grid md:grid-cols-3 gap-4 md:gap-6">
        <li v-for="(st, n) in steps" :key="n" class="card p-5 relative">
          <div class="flex items-center gap-3">
            <span class="size-11 rounded-xl grid place-items-center text-white shrink-0" :class="n === 1 ? 'bg-pink' : 'bg-[var(--blue)]'"><Icon :name="st.icon" :size="22" weight="bold" /></span>
            <span class="text-xs font-semibold tracking-wide uppercase" :class="n === 1 ? 'text-pink-ink' : 'text-accent-ink'">Step {{ n + 1 }}</span>
          </div>
          <h3 class="mt-4 text-base font-semibold">{{ st.title }}</h3>
          <p class="text-muted mt-1.5 text-sm leading-relaxed">{{ st.text }}</p>
          <span v-if="n < 2" class="hidden md:grid absolute -right-[1.1rem] top-1/2 -translate-y-1/2 size-8 rounded-full bg-bg border border-line place-items-center text-muted z-10"><Icon name="arrowRight" :size="15" weight="bold" /></span>
        </li>
      </ol>
      <AdSlot kind="banner" class="mt-10" />
      <p class="text-center text-sm text-muted mt-8">Need privacy? <NuxtLink to="/chat" class="text-accent-ink font-semibold underline">Start an encrypted chat room</NuxtLink> that disappears when everyone leaves. Anyone on your network shares the space, so avoid putting secrets in the shared text on public Wi-Fi.</p>
    </section>

    <template #fallback>
      <div aria-hidden="true"><div class="h-12 w-60 rounded-lg bg-surface-2 mb-4" /><div class="h-[46dvh] min-h-64 rounded-xl bg-surface border border-line" /></div>
    </template>
    </ClientOnly>
  </div>
</template>
