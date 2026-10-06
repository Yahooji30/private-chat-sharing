<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { useAuth } from '../stores/auth'

const router = useRouter(), route = useRoute(), auth = useAuth()
const email = ref(''), password = ref(''), code = ref(''), pending = ref(''), error = ref(''), busy = ref(false)

async function done(): Promise<void> { await auth.load(); await router.push(typeof route.query.next === 'string' ? route.query.next : '/') }
async function submit(): Promise<void> {
  error.value = ''; busy.value = true
  try {
    if (pending.value) { await api('/admin/auth/totp', { method: 'POST', body: { pendingToken: pending.value, code: code.value } }); await done() }
    else {
      const r = await api<{ ok?: boolean; totpRequired?: boolean; pendingToken?: string }>('/admin/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
      if (r.totpRequired && r.pendingToken) pending.value = r.pendingToken; else await done()
    }
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
</script>

<template>
  <div class="min-h-dvh grid place-items-center p-4">
    <form class="card w-full max-w-sm p-6 space-y-4" @submit.prevent="submit">
      <div class="flex items-center gap-3"><img src="/icon.svg" alt="" width="40" height="40" class="rounded-xl"><div><h1 class="text-xl font-bold">Admin sign in</h1><p class="text-sm text-muted">{{ pending ? 'Enter your authenticator code' : 'Use your admin account' }}</p></div></div>
      <template v-if="!pending">
        <div><label class="label" for="email">Email</label><input id="email" v-model="email" type="email" class="input" autocomplete="username" required autofocus></div>
        <div><label class="label" for="pw">Password</label><input id="pw" v-model="password" type="password" class="input" autocomplete="current-password" required></div>
      </template>
      <div v-else><label class="label" for="code">6-digit code</label><input id="code" v-model="code" class="input text-center tracking-[0.4em] font-mono text-lg" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required autofocus></div>
      <p v-if="error" class="text-sm text-accent-ink" role="alert">{{ error }}</p>
      <button class="btn btn-accent w-full !min-h-11" :disabled="busy">{{ pending ? 'Verify' : 'Sign in' }}</button>
    </form>
  </div>
</template>
