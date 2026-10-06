<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { useAuth } from '../stores/auth'
import { confirmDialog, fail, ok } from '../ui'

const auth = useAuth(), router = useRouter()
const pw = reactive({ old: '', next: '' }), setup = ref<{ secret: string; qr: string } | null>(null), code = ref('')
async function change(): Promise<void> { try { await api('/admin/auth/password', { method: 'POST', body: { ...pw } }); pw.old = ''; pw.next = ''; ok('Password changed. Other sessions were signed out.') } catch (e) { fail(e) } }
async function begin(): Promise<void> { try { setup.value = await api('/admin/auth/totp/setup', { method: 'POST' }) } catch (e) { fail(e) } }
async function enable(): Promise<void> { try { await api('/admin/auth/totp/enable', { method: 'POST', body: { code: code.value } }); setup.value = null; code.value = ''; await auth.load(); ok('Two-factor authentication enabled') } catch (e) { fail(e) } }
async function disable(): Promise<void> { if (await confirmDialog('Turn off 2FA', 'Your account will only need a password.')) { try { await api('/admin/auth/totp/disable', { method: 'POST' }); await auth.load(); ok('2FA disabled') } catch (e) { fail(e) } } }
async function all(): Promise<void> { if (await confirmDialog('Sign out everywhere', 'Every session, including this one, will end.', false)) { await api('/admin/auth/logout-all', { method: 'POST' }).catch(() => undefined); auth.me = null; await router.push('/login') } }
</script>

<template>
  <div class="space-y-4 max-w-xl"><h1 class="text-2xl font-bold">Account</h1>
    <p class="text-sm text-muted">{{ auth.me?.name }} · {{ auth.me?.email }}</p>
    <form class="card p-4 space-y-3" @submit.prevent="change"><h2 class="font-semibold">Change password</h2>
      <div><label class="label" for="o">Current password</label><input id="o" v-model="pw.old" type="password" class="input" autocomplete="current-password" required></div>
      <div><label class="label" for="n">New password (12+ characters)</label><input id="n" v-model="pw.next" type="password" class="input" minlength="12" autocomplete="new-password" required></div>
      <button class="btn btn-accent">Change password</button></form>
    <div class="card p-4 space-y-3"><h2 class="font-semibold">Two-factor authentication</h2>
      <template v-if="auth.me?.totpEnabled"><p class="text-sm text-ok">Enabled</p><button class="btn btn-danger" @click="disable">Turn off</button></template>
      <template v-else-if="setup"><p class="text-sm text-muted">Scan with an authenticator app, then enter the 6-digit code.</p><img :src="setup.qr" alt="TOTP QR code" width="180" height="180" class="rounded-lg bg-white"><p class="text-xs font-mono break-all">{{ setup.secret }}</p>
        <form class="flex gap-2" @submit.prevent="enable"><input v-model="code" class="input" inputmode="numeric" maxlength="6" placeholder="123456" aria-label="Code" required><button class="btn btn-accent">Enable</button></form></template>
      <button v-else class="btn" @click="begin">Set up 2FA</button></div>
    <button class="btn" @click="all">Sign out of all sessions</button>
  </div>
</template>
