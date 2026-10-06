<script setup lang="ts">
import QRCode from 'qrcode'
const props = defineProps<{ code: string }>()
const toast = useToast()
const canvas = useTemplateRef<HTMLCanvasElement>('qr')
const url = computed(() => `${location.origin}/c/${props.code}`)
const canShare = import.meta.client && !!navigator.share
onMounted(() => { if (canvas.value) void QRCode.toCanvas(canvas.value, url.value, { margin: 1, width: 160, color: { dark: '#1b1b1f', light: '#ffffff' } }) })
async function copy(): Promise<void> { if (await copyText(url.value)) toast.ok('Link copied') }
async function share(): Promise<void> { try { await navigator.share({ title: 'Join my private chat', url: url.value }) } catch { /* dismissed */ } }
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-4 items-center">
    <canvas ref="qr" width="160" height="160" class="rounded-xl border border-line bg-white size-36 shrink-0" aria-label="Room QR code" />
    <div class="min-w-0 w-full space-y-2">
      <code class="block truncate px-3 py-2.5 rounded-lg bg-surface-2 border border-line text-sm font-mono">{{ url }}</code>
      <div class="flex gap-2"><button class="btn flex-1" @click="copy"><Icon name="copy" :size="15" />Copy link</button><button v-if="canShare" class="btn flex-1" @click="share"><Icon name="share" :size="15" />Share</button></div>
      <p class="text-xs text-muted">Share the password separately, through a different channel. It never leaves your device.</p>
    </div>
  </div>
</template>
