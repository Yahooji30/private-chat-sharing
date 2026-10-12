<script setup lang="ts">
import QRCode from 'qrcode'
import { chatShareText } from '@sync/shared'
const props = defineProps<{ code: string }>()
const toast = useToast()
const canvas = useTemplateRef<HTMLCanvasElement>('qr')
const url = computed(() => `${location.origin}/c/${props.code}`)
const canShare = import.meta.client && !!navigator.share
// SMS links only make sense on a phone or tablet
const isMobile = import.meta.client && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches))
const password = roomPassword(props.code)
const withPassword = ref(!!password)

// The admin can reword the invite (Admin > Site settings). null = not loaded yet, '' = use the built-in wording.
const template = useState<string | null>('chat-share-template', () => null)
onMounted(async () => {
  if (canvas.value) void QRCode.toCanvas(canvas.value, url.value, { margin: 1, width: 160, color: { dark: '#0F1424', light: '#ffffff' } })
  if (template.value === null) {
    // no-cache: the endpoint allows shared caches to serve a minute-old copy; the admin's latest wording should win
    try { template.value = (await $fetch<Record<string, string>>('/api/site', { cache: 'no-cache' })).chat_share_message ?? '' } catch { template.value = '' }
  }
})

const message = computed(() => chatShareText(template.value ?? '', url.value, withPassword.value ? password : undefined))
const enc = encodeURIComponent
const channels = computed(() => [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', href: `https://wa.me/?text=${enc(message.value)}`, show: true },
  { key: 'sms', label: 'SMS', icon: 'chat', href: `sms:?&body=${enc(message.value)}`, show: isMobile },
  { key: 'email', label: 'Email', icon: 'mail', href: `mailto:?subject=${enc('I have sent you a secret message')}&body=${enc(message.value)}`, show: true },
].filter(c => c.show))
async function copyMessage(): Promise<void> { if (await copyText(message.value)) toast.ok('Message copied') }
async function copyLink(): Promise<void> { if (await copyText(url.value)) toast.ok('Link copied') }
async function share(): Promise<void> { try { await navigator.share({ title: 'A secret message for you', text: message.value }) } catch { /* dismissed */ } }
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <a v-for="(c, n) in channels" :key="c.key" :href="c.href" target="_blank" rel="noopener noreferrer" class="btn !min-h-9 !px-3.5 text-sm" :class="n === 0 ? 'btn-accent' : ''" :data-testid="`share-${c.key}`">
        <Icon :name="c.icon" :size="16" />{{ c.label }}
      </a>
      <button v-if="canShare" class="btn !min-h-9 !px-3.5 text-sm" data-testid="share-native" @click="share"><Icon name="share" :size="16" />Share</button>
      <button class="btn !min-h-9 !px-3.5 text-sm" data-testid="share-copy-message" @click="copyMessage"><Icon name="copy" :size="16" />Copy message</button>
    </div>

    <label v-if="password" class="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3 cursor-pointer">
      <input v-model="withPassword" type="checkbox" class="mt-0.5 size-4 accent-[var(--accent)]" data-testid="share-with-password">
      <span class="text-sm"><span class="font-medium">Include the password in the message</span>
        <span class="block text-muted text-[0.8125rem] mt-0.5">Safer to send it on a different channel. Turn this off and the message says the password comes separately.</span></span>
    </label>

    <section class="flex flex-col sm:flex-row gap-4 items-center border-t border-line pt-4" aria-label="Room link and QR code">
      <canvas ref="qr" width="160" height="160" class="rounded-lg border border-line bg-white size-28 shrink-0" aria-label="Room QR code" />
      <div class="min-w-0 w-full space-y-2">
        <code class="block truncate px-3 py-2.5 rounded-lg bg-surface-2 border border-line text-sm font-mono">{{ url }}</code>
        <button class="btn !min-h-9 !px-3.5 text-sm" @click="copyLink"><Icon name="copy" :size="16" />Copy link</button>
      </div>
    </section>
  </div>
</template>
