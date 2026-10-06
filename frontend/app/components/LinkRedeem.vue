<script setup lang="ts">
const props = defineProps<{ initial?: string; autofocus?: boolean }>()
const emit = defineEmits<{ done: [] }>()
const toast = useToast()
const code = ref(props.initial ?? '')
const busy = ref(false)
const scanning = ref(false)
const video = useTemplateRef<HTMLVideoElement>('video')
let scanner: { stop: () => void; destroy: () => void } | null = null

const clean = computed(() => code.value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8))
const shown = computed(() => (clean.value.length > 4 ? `${clean.value.slice(0, 4)}-${clean.value.slice(4)}` : clean.value))

async function redeem(c = clean.value): Promise<void> {
  if (c.length !== 8 || busy.value) return
  busy.value = true
  try {
    await api('/link/redeem', { method: 'POST', body: { code: c } })
    toast.ok('Device linked')
    emit('done')
  } catch (e) { toast.err((e as Error).message) } finally { busy.value = false }
}

async function scan(): Promise<void> {
  scanning.value = true
  await nextTick()
  try {
    const { default: QrScanner } = await import('qr-scanner')
    const s = new QrScanner(video.value as HTMLVideoElement, r => {
      const m = /[?&]c=([0-9A-Za-z]{8})/.exec(r.data) ?? /^([0-9A-Za-z]{4}-?[0-9A-Za-z]{4})$/.exec(r.data)
      if (!m?.[1]) return
      stopScan()
      code.value = m[1]
      void redeem(m[1].replace('-', '').toUpperCase())
    }, { highlightScanRegion: true, preferredCamera: 'environment' })
    scanner = s
    await s.start()
  } catch { scanning.value = false; toast.err('Camera not available. Type the code instead.') }
}
function stopScan(): void { scanner?.stop(); scanner?.destroy(); scanner = null; scanning.value = false }
onBeforeUnmount(stopScan)
watch(() => props.initial, v => { if (v) code.value = v })
onMounted(() => { if (props.initial && clean.value.length === 8) void redeem() })
</script>

<template>
  <div class="space-y-3">
    <form class="flex gap-2" @submit.prevent="redeem()">
      <input :value="shown" class="input font-mono text-lg tracking-[0.2em] text-center uppercase" placeholder="XXXX-XXXX" inputmode="text" autocapitalize="characters"
        autocomplete="off" spellcheck="false" aria-label="Link code" :autofocus="autofocus" @input="code = ($event.target as HTMLInputElement).value">
      <button class="btn btn-accent !min-h-11 px-5" :disabled="clean.length !== 8 || busy">Link</button>
    </form>
    <button v-if="!scanning" class="btn w-full" type="button" @click="scan"><Icon name="qr" :size="16" />Scan QR code</button>
    <div v-else class="relative rounded-2xl overflow-hidden bg-black aspect-square">
      <video ref="video" class="size-full object-cover" playsinline muted />
      <button class="absolute top-2 right-2 btn !px-0 w-10" aria-label="Stop camera" @click="stopScan"><Icon name="x" /></button>
    </div>
  </div>
</template>
