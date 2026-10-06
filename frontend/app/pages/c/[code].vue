<script setup lang="ts">
const route = useRoute()
const code = String(route.params.code).toUpperCase()
useHead({ title: 'Private chat', meta: [{ name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] })
const chat = useChat(code)
const toast = useToast()
const pw = ref('')
const unlocking = ref(false)
const draft = ref('')
const blurOn = ref(false)
const blurred = ref(false)
const showShare = ref(false)
const listEl = useTemplateRef<HTMLElement>('list')
const palette = ['#cf3f3f', '#2563eb', '#15803d', '#7e22ce']
const mineIsCreator = computed(() => { try { return !!localStorage.getItem(`sync:chat:manage:${code}`) } catch { return false } })

onMounted(() => { if (hasKeys(code)) void chat.join() })
onBeforeUnmount(() => chat.dispose())
useEventListener(window, 'blur', () => { if (blurOn.value) blurred.value = true })
useEventListener(window, 'focus', () => { blurred.value = false })
watch(() => chat.msgs.value.length, async () => { await nextTick(); listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' }) })

const color = (slot: number): number => chat.members.palette[slot] ?? slot
async function unlock(): Promise<void> {
  if (!pw.value) return
  unlocking.value = true
  try { await chat.unlock(pw.value); pw.value = '' } finally { unlocking.value = false }
}
async function send(): Promise<void> {
  const t = draft.value
  if (!t.trim()) return
  draft.value = ''
  chat.setTyping(false)
  if (!await chat.send(t)) { draft.value = t; toast.err('Message not sent') }
}
function onKey(e: KeyboardEvent): void { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }
function leave(): void { if (confirm('Leave and wipe this chat from your screen?')) { chat.leave(); void navigateTo('/chat') } }
async function destroy(): Promise<void> {
  if (!confirm('Delete this room for everyone?')) return
  try {
    const manageToken = localStorage.getItem(`sync:chat:manage:${code}`) ?? ''
    await api(`/chat/rooms/${code}/manage`, { method: 'POST', body: { action: 'delete', manageToken } })
    localStorage.removeItem(`sync:chat:manage:${code}`)
    void navigateTo('/chat')
  } catch (e) { toast.err((e as Error).message) }
}
</script>

<template>
  <div class="fixed inset-0 top-14 md:top-16 flex flex-col bg-bg" :style="{ paddingBottom: 'var(--safe-b)' }">
    <!-- password gate -->
    <div v-if="chat.phase.value === 'password' || unlocking" class="m-auto w-full max-w-sm px-4">
      <form class="card p-6 space-y-4" @submit.prevent="unlock">
        <div class="size-12 rounded-2xl bg-accent-soft text-accent-ink grid place-items-center"><Icon name="lock" :size="24" /></div>
        <div><h1 class="text-2xl font-bold">Join room <span class="font-mono text-accent-ink">{{ code }}</span></h1><p class="text-sm text-muted mt-1">Enter the room password. It stays on this device.</p></div>
        <input v-model="pw" type="password" class="input" placeholder="Room password" autocomplete="off" autofocus aria-label="Room password">
        <p v-if="chat.error.value" class="text-sm text-accent-ink" role="alert">{{ chat.error.value }}</p>
        <button class="btn btn-accent w-full !min-h-12 text-base" :disabled="!pw || unlocking">{{ unlocking ? 'Unlocking...' : 'Join chat' }}</button>
        <NuxtLink to="/chat" class="block text-center text-sm text-muted">Create a new room instead</NuxtLink>
      </form>
    </div>

    <div v-else-if="chat.phase.value === 'joining'" class="m-auto text-muted flex items-center gap-2"><Icon name="refresh" class="animate-spin" />Joining securely...</div>

    <div v-else-if="chat.phase.value === 'full'" class="m-auto text-center px-6 space-y-3">
      <div class="size-14 mx-auto rounded-2xl bg-accent-soft text-accent-ink grid place-items-center"><Icon name="users" :size="26" /></div>
      <h1 class="text-2xl font-bold">Room full (4/4)</h1><p class="text-muted">Ask someone to leave, then try again.</p>
      <button class="btn btn-accent" @click="chat.phase.value = 'password'">Try again</button>
    </div>

    <div v-else-if="['closed', 'lost'].includes(chat.phase.value)" class="m-auto text-center px-6 space-y-3">
      <div class="size-14 mx-auto rounded-2xl bg-accent-soft text-accent-ink grid place-items-center"><Icon name="mask" :size="26" /></div>
      <h1 class="text-2xl font-bold">{{ chat.phase.value === 'closed' ? 'This room was closed' : 'Connection lost' }}</h1>
      <p class="text-muted">The chat was wiped from this device.</p>
      <NuxtLink to="/chat" class="btn btn-accent">Start a new room</NuxtLink>
    </div>

    <template v-else>
      <header class="px-3 md:px-4 h-14 flex items-center gap-2 border-b border-line bg-surface/90 backdrop-blur">
        <div class="min-w-0"><p class="font-semibold leading-tight inline-flex items-center gap-1.5"><Icon name="lock" :size="14" class="text-ok" />Room <span class="font-mono">{{ code }}</span></p>
          <p class="text-xs text-muted flex items-center gap-1.5"><span class="flex gap-0.5"><span v-for="(on, i) in chat.members.slots" :key="i" class="size-2 rounded-full" :style="{ background: on ? palette[color(i)] : 'var(--line)' }" /></span>{{ chat.members.count }}/4 in room<span v-if="chat.phase.value === 'reconnecting'" class="text-warn"> · reconnecting...</span></p></div>
        <div class="ml-auto flex gap-1.5">
          <button class="btn !px-2.5" :aria-pressed="blurOn" :class="blurOn ? 'btn-soft' : ''" aria-label="Blur when tab loses focus" title="Blur when tab loses focus" @click="blurOn = !blurOn"><Icon name="mask" :size="17" /></button>
          <button class="btn !px-2.5" aria-label="Invite" @click="showShare = !showShare"><Icon name="share" :size="17" /></button>
          <button v-if="mineIsCreator" class="btn !px-2.5" aria-label="Delete room" @click="destroy"><Icon name="trash" :size="17" /></button>
          <button class="btn btn-accent" @click="leave">Leave<span class="hidden sm:inline">&nbsp;&amp; wipe</span></button>
        </div>
      </header>
      <div v-if="showShare" class="p-3 border-b border-line bg-bg"><ChatShare :code="code" /></div>

      <div ref="list" class="flex-1 overflow-y-auto scroll-thin px-3 md:px-4 py-4 space-y-1.5 transition" :class="blurred ? 'blur-md select-none' : ''" aria-live="polite" aria-label="Messages">
        <p v-if="!chat.msgs.value.length" class="text-center text-sm text-muted pt-10">You are the only one who can read this. Messages vanish when everyone leaves.</p>
        <template v-for="m in chat.msgs.value" :key="m.id">
          <p v-if="m.slot < 0" class="text-center text-xs text-muted py-1">{{ m.text }}</p>
          <div v-else class="flex" :class="m.mine ? 'justify-end' : 'justify-start'">
            <div class="max-w-[82%] md:max-w-[60%] px-3.5 py-2 rounded-2xl whitespace-pre-wrap break-words anim-pop"
              :class="m.mine ? 'rounded-br-md text-white' : 'rounded-bl-md text-white'" :style="{ background: palette[color(m.slot)] }">{{ m.text }}</div>
          </div>
        </template>
        <div v-if="chat.typing.value.size" class="flex gap-1 px-2 py-2" aria-label="Someone is typing"><span v-for="n in 3" :key="n" class="size-2 rounded-full bg-muted animate-bounce" :style="{ animationDelay: `${n * 120}ms` }" /></div>
      </div>

      <form class="p-2 md:p-3 border-t border-line bg-surface flex gap-2 items-end" @submit.prevent="send">
        <textarea v-model="draft" rows="1" maxlength="2000" class="input !min-h-11 max-h-32 py-2.5 resize-none flex-1" placeholder="Write a message" aria-label="Message" enterkeyhint="send"
          @keydown="onKey" @input="chat.setTyping(true)" />
        <button class="btn btn-accent !min-h-11 !px-4" :disabled="!draft.trim() || chat.phase.value !== 'live'" aria-label="Send"><Icon name="send" :size="18" /></button>
      </form>
    </template>
  </div>
</template>
