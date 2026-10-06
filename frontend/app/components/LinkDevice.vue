<script setup lang="ts">
import QRCode from 'qrcode'
import { fmtClock } from '~/utils/format'

type Mode = 'qr' | 'share' | 'ip'
const toast = useToast()
const origin = import.meta.client ? location.origin : ''
const mode = ref<Mode>('qr')
const hasCode = ref(false)
const gen = ref<{ code: string; url: string; expiresAt: number } | null>(null)
const now = ref(Date.now())
const qr = useTemplateRef<HTMLCanvasElement>('qr')
const ip = ref('')
const busy = ref(false)
const ipMsg = ref('')
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))

const left = computed(() => (gen.value ? gen.value.expiresAt - now.value : 0))
const digits = computed(() => (gen.value?.code ?? '').split(''))

async function generate(): Promise<void> {
  busy.value = true
  try {
    gen.value = await api('/link/code', { method: 'POST' })
    await nextTick(); await draw()
  } catch (e) { toast.err((e as Error).message) } finally { busy.value = false }
}
async function draw(): Promise<void> {
  if (!gen.value || !qr.value) return
  await QRCode.toCanvas(qr.value, gen.value.url, { errorCorrectionLevel: 'H', margin: 1, width: 240, color: { dark: '#1b1b1f', light: '#ffffff' } })
}
watch(mode, async m => { if (m === 'qr') { await nextTick(); await draw() } })
watch(left, l => { if (gen.value && l <= 0) gen.value = null })
onMounted(generate)

async function copy(t: string, label: string): Promise<void> {
  if (await copyText(t)) toast.ok(`${label} copied`); else toast.err('Copy failed')
}
const reload = (): void => { location.href = '/' }
async function linkIp(): Promise<void> {
  ipMsg.value = ''
  busy.value = true
  try { await api('/link/ip', { method: 'POST', body: { ip: ip.value.trim() } }); toast.ok('Network linked'); ip.value = '' }
  catch (e) { toast.err((e as Error).message) } finally { busy.value = false }
}
async function check(): Promise<void> {
  try { ipMsg.value = (await api<{ linked: boolean }>(`/link/check?ip=${encodeURIComponent(ip.value.trim())}`)).linked ? 'Yes, this network is already linked.' : 'Not linked yet.' }
  catch (e) { ipMsg.value = (e as Error).message }
}
const modes: { id: Mode; label: string; icon: string }[] = [{ id: 'qr', label: 'QR Code', icon: 'qr' }, { id: 'share', label: 'Share Link', icon: 'share' }, { id: 'ip', label: 'IP Address', icon: 'globe' }]
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-line text-sm">
      <span class="text-muted">Choose how to connect another device.</span>
      <button class="text-accent-ink font-medium inline-flex items-center gap-1.5" @click="hasCode = !hasCode"><Icon name="key" :size="15" />Have a code?</button>
    </div>
    <div v-if="hasCode" class="p-4 border-b border-line bg-surface-2/50"><LinkRedeem @done="reload()" /></div>
    <div class="p-3">
      <div class="grid grid-cols-3 gap-1 rounded-xl border border-line p-1" role="tablist">
        <button v-for="m in modes" :key="m.id" role="tab" :aria-selected="mode === m.id" class="h-10 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1.5 transition"
          :class="mode === m.id ? 'bg-surface-2' : 'text-muted'" @click="mode = m.id"><Icon :name="m.icon" :size="15" /><span class="hidden min-[400px]:inline">{{ m.label }}</span></button>
      </div>

      <div v-if="mode === 'qr'" class="pt-5 pb-2 flex flex-col items-center gap-3">
        <div class="relative p-3 bg-white rounded-3xl border-[3px] border-accent" :class="gen ? '' : 'opacity-40'">
          <canvas ref="qr" width="240" height="240" class="block size-[220px] sm:size-[240px]" aria-label="Link QR code" />
          <img v-if="gen" src="/icon.svg" alt="" class="absolute inset-0 m-auto size-12 rounded-xl ring-4 ring-white">
        </div>
        <p class="text-sm text-muted text-center">Scan this QR code on the device you want to link.</p>
        <p class="text-xs text-muted" aria-live="off">{{ gen ? `Expires in ${fmtClock(left)}` : 'Code expired' }}</p>
        <button class="btn" :disabled="busy" @click="generate"><Icon name="refresh" :size="15" />Refresh QR Code</button>
      </div>

      <div v-else-if="mode === 'share'" class="pt-3 space-y-3">
        <div class="card p-4 space-y-4">
          <div>
            <p class="flex items-center gap-2 font-medium"><span class="text-[11px] bg-surface-2 border border-line rounded-md px-1.5 py-0.5">Step 1</span>Open this link</p>
            <div class="flex gap-2 mt-2">
              <code class="flex-1 min-w-0 truncate px-3 py-2.5 rounded-lg bg-surface-2 border border-line text-sm font-mono">{{ origin }}/link</code>
              <button class="btn" @click="copy(`${origin}/link`, 'Link')"><Icon name="copy" :size="15" />Copy</button>
            </div>
          </div>
          <div class="border-t border-line pt-4">
            <p class="flex items-center gap-2 font-medium"><span class="text-[11px] bg-surface-2 border border-line rounded-md px-1.5 py-0.5">Step 2</span>Enter this code
              <span class="ml-auto text-xs font-normal text-muted">{{ gen ? `Expires in ${fmtClock(left)}` : 'Expired' }}</span></p>
            <div class="flex items-center gap-2 mt-3 flex-wrap">
              <div class="flex items-center gap-1 sm:gap-1.5 mx-auto sm:mx-0">
                <template v-for="(d, i) in digits" :key="i">
                  <span v-if="i === 4" class="text-muted">-</span>
                  <span class="size-9 sm:size-10 grid place-items-center rounded-lg border border-line bg-surface text-lg font-semibold">{{ d }}</span>
                </template>
                <span v-if="!gen" class="text-muted text-sm">--------</span>
              </div>
              <button class="btn ml-auto" :disabled="!gen" @click="copy(gen?.code ?? '', 'Code')"><Icon name="copy" :size="15" />Copy</button>
            </div>
          </div>
        </div>
        <div class="text-center"><button class="btn" :disabled="busy" @click="generate"><Icon name="refresh" :size="15" />Refresh Code</button></div>
      </div>

      <div v-else class="pt-4 space-y-3">
        <p class="text-sm text-muted">Enter the IP address of the network you want to link. Both networks then share the same space.</p>
        <form class="flex gap-2" @submit.prevent="linkIp">
          <input v-model="ip" class="input" placeholder="e.g. 203.0.113.10" inputmode="decimal" autocomplete="off" aria-label="IP address">
          <button class="btn btn-accent !min-h-11 px-5" :disabled="!ip.trim() || busy">Link</button>
        </form>
        <button class="text-accent-ink text-sm font-medium" :disabled="!ip.trim()" @click="check">Check if already linked →</button>
        <p v-if="ipMsg" class="text-sm text-muted" role="status">{{ ipMsg }}</p>
      </div>
    </div>
  </div>
</template>
