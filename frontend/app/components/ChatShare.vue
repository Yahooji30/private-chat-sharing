<script setup lang="ts">
import QRCode from 'qrcode'
import { chatShareText } from '@sync/shared'
const props = defineProps<{ code: string }>()
const toast = useToast()
const canvas = useTemplateRef<HTMLCanvasElement>('qr')
const url = computed(() => `${location.origin}/c/${props.code}`)
const canShare = import.meta.client && !!navigator.share

// The admin can reword the invite (Admin > Site settings). null = not loaded yet, '' = use the built-in wording.
const template = useState<string | null>('chat-share-template', () => null)
onMounted(async () => {
  if (canvas.value) void QRCode.toCanvas(canvas.value, url.value, { margin: 1, width: 160, color: { dark: '#1b1b1f', light: '#ffffff' } })
  if (template.value === null) {
    // no-cache: the endpoint allows shared caches to serve a minute-old copy; the admin's latest wording should win
    try { template.value = (await $fetch<Record<string, string>>('/api/site', { cache: 'no-cache' })).chat_share_message ?? '' } catch { template.value = '' }
  }
})

/** Exactly what the receiver gets: the sentence, then the room link. The room password is never part of it. */
const message = computed(() => chatShareText(template.value ?? '', url.value))
const enc = encodeURIComponent
const channels = computed(() => {
  // Telegram adds the link itself, so give it the sentence without the link
  const noLink = message.value.replaceAll(url.value, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return [
    { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', href: `https://wa.me/?text=${enc(message.value)}`, primary: true },
    { key: 'telegram', label: 'Telegram', icon: 'send', href: `https://t.me/share/url?url=${enc(url.value)}&text=${enc(noLink)}` },
    { key: 'email', label: 'Email', icon: 'mail', href: `mailto:?subject=${enc('I have sent you a secret message')}&body=${enc(message.value)}` },
    { key: 'sms', label: 'SMS', icon: 'chat', href: `sms:?&body=${enc(message.value)}` },
  ]
})
async function copyMessage(): Promise<void> { if (await copyText(message.value)) toast.ok('Message copied. Paste it anywhere.') }
async function copyLink(): Promise<void> { if (await copyText(url.value)) toast.ok('Link copied') }
async function share(): Promise<void> { try { await navigator.share({ title: 'A secret message for you', text: message.value }) } catch { /* dismissed */ } }
</script>

<template>
  <div class="space-y-4">
    <section aria-labelledby="invite-msg" class="space-y-2.5">
      <h3 id="invite-msg" class="text-sm font-semibold">Message that will be sent</h3>
      <p class="rounded-2xl rounded-bl-md bg-surface-2 border border-line px-3.5 py-3 text-sm whitespace-pre-line break-words" data-testid="invite-preview">{{ message }}</p>
      <div class="grid grid-cols-3 gap-2">
        <a v-for="c in channels" :key="c.key" :href="c.href" target="_blank" rel="noopener noreferrer" class="btn !min-h-11 !px-2" :class="c.primary ? 'btn-accent col-span-3' : ''" :data-testid="`share-${c.key}`">
          <Icon :name="c.icon" :size="17" />{{ c.label }}
        </a>
        <button v-if="canShare" class="btn !min-h-11 col-span-3" data-testid="share-native" @click="share"><Icon name="share" :size="16" />More apps...</button>
        <button class="btn !min-h-11 col-span-3" data-testid="share-copy-message" @click="copyMessage"><Icon name="copy" :size="16" />Copy message</button>
      </div>
    </section>

    <section class="flex flex-col sm:flex-row gap-4 items-center border-t border-line pt-4" aria-label="Room link and QR code">
      <canvas ref="qr" width="160" height="160" class="rounded-xl border border-line bg-white size-32 shrink-0" aria-label="Room QR code" />
      <div class="min-w-0 w-full space-y-2">
        <code class="block truncate px-3 py-2.5 rounded-lg bg-surface-2 border border-line text-sm font-mono">{{ url }}</code>
        <button class="btn w-full" @click="copyLink"><Icon name="copy" :size="15" />Copy link only</button>
      </div>
    </section>
    <p class="text-xs text-muted">Tell the password separately, through a different channel. It never leaves your device, so it cannot be put in the message for you.</p>
  </div>
</template>
