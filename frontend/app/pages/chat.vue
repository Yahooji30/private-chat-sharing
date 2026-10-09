<script setup lang="ts">
import { strength } from '~/lib/crypto/chat'
useAppSeo('chat', { title: 'Secure Chat', description: 'Start a private, end-to-end encrypted chat room in seconds. Password protected, up to four people, no accounts and no history.' })
const toast = useToast()
const pw = ref('')
const custom = ref('')
const join = ref('')
const busy = ref(false)
const show = ref(false)
const score = computed(() => strength(pw.value))
const tone = ['bg-line', 'bg-accent', 'bg-warn', 'bg-ok', 'bg-ok']
const names = ['Too short', 'Weak', 'Okay', 'Good', 'Strong']

async function create(): Promise<void> {
  if (pw.value.length < 8) return toast.warn('Use at least 8 characters')
  busy.value = true
  try {
    const r = await createRoom(pw.value, custom.value.trim())
    await navigateTo(`/c/${r.code}`)
  } catch (e) { toast.err((e as Error).message) } finally { busy.value = false }
}
const open = (): void => { const c = join.value.trim().split('/').pop() ?? ''; if (/^[A-Za-z0-9]{4,16}$/.test(c)) void navigateTo(`/c/${c.toUpperCase()}`); else toast.warn('Enter a valid room code') }
const points = [
  ['lock', 'End-to-end encrypted', 'Messages are encrypted on your device. The server only relays ciphertext.'],
  ['users', 'Up to 4 people', 'Password protected room. Share the link and the password separately.'],
  ['mask', 'No history, no traces', 'New joiners see nothing from before. The room is wiped when the last person leaves.'],
]
</script>

<template>
  <div class="max-w-5xl mx-auto pt-3 md:pt-8 grid md:grid-cols-2 gap-4 md:gap-8 items-start">
    <div class="space-y-3 md:pt-4">
      <h1 class="text-3xl md:text-4xl font-bold tracking-tight">Private chat that <span class="text-accent">disappears</span></h1>
      <p class="text-muted text-lg">Start a throwaway room in seconds. No accounts, no names, no history.</p>
      <ul class="space-y-3 pt-3">
        <li v-for="p in points" :key="p[1]" class="flex gap-3"><span class="size-10 rounded-xl bg-accent-soft text-accent-ink grid place-items-center shrink-0"><Icon :name="p[0]!" /></span>
          <div><p class="font-semibold">{{ p[1] }}</p><p class="text-sm text-muted">{{ p[2] }}</p></div></li>
      </ul>
    </div>
    <div class="space-y-3">
      <form class="card p-5 space-y-4" @submit.prevent="create">
        <h2 class="text-lg font-semibold">Create a room</h2>
        <label class="block"><span class="text-sm font-medium">Password</span>
          <div class="relative mt-1.5"><input v-model="pw" :type="show ? 'text' : 'password'" class="input pr-16" autocomplete="new-password" placeholder="At least 8 characters" aria-describedby="pwmeter">
            <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted px-2 py-1" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button></div>
          <div id="pwmeter" class="flex items-center gap-2 mt-2"><div class="flex gap-1 flex-1"><span v-for="n in 4" :key="n" class="h-1.5 flex-1 rounded-full" :class="n <= score ? tone[score] : 'bg-line'" /></div>
            <span class="text-xs text-muted w-16 text-right">{{ pw ? names[score] : '' }}</span></div></label>
        <label class="block"><span class="text-sm font-medium">Room code <span class="text-muted font-normal">(optional)</span></span>
          <input v-model="custom" class="input mt-1.5 uppercase" maxlength="16" pattern="[A-Za-z0-9]{4,16}" placeholder="Auto-generated" autocomplete="off"></label>
        <button class="btn btn-accent w-full !min-h-12 text-base" :disabled="busy">{{ busy ? 'Creating...' : 'Create secure room' }}</button>
        <p class="text-xs text-muted">Your password is stretched with PBKDF2 on this device. We never receive it.</p>
      </form>
      <form class="card p-5 flex gap-2 items-end" @submit.prevent="open">
        <label class="flex-1"><span class="text-sm font-medium">Have a room link or code?</span><input v-model="join" class="input mt-1.5" placeholder="Room code" autocomplete="off" autocapitalize="characters"></label>
        <button class="btn !min-h-11 px-5">Join</button>
      </form>
    </div>
  </div>
</template>
