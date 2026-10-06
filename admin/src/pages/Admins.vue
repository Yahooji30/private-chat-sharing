<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import { confirmDialog, fail, fmtDate, ok } from '../ui'

interface A { id: string; email: string; name: string; role: string; totpEnabled: boolean; createdAt: number }
const rows = ref<A[]>([]), f = reactive({ email: '', name: '', password: '', role: 'admin' })
const load = async (): Promise<void> => { try { rows.value = await api<A[]>('/admin/admins') } catch (e) { fail(e) } }
onMounted(load)
async function add(): Promise<void> { try { await api('/admin/admins', { method: 'POST', body: { ...f } }); Object.assign(f, { email: '', name: '', password: '', role: 'admin' }); ok('Admin added'); await load() } catch (e) { fail(e) } }
async function del(a: A): Promise<void> { if (!await confirmDialog('Remove admin', `${a.email} will lose access immediately.`)) return; try { await api(`/admin/admins/${a.id}`, { method: 'DELETE' }); ok('Removed'); await load() } catch (e) { fail(e) } }
</script>

<template>
  <div class="space-y-4 max-w-4xl"><h1 class="text-2xl font-bold">Admins</h1>
    <form class="card p-4 grid sm:grid-cols-2 gap-3" @submit.prevent="add">
      <div><label class="label" for="ae">Email</label><input id="ae" v-model="f.email" type="email" class="input" required></div><div><label class="label" for="an">Name</label><input id="an" v-model="f.name" class="input" required></div>
      <div><label class="label" for="ap">Password (12+ characters)</label><input id="ap" v-model="f.password" type="password" class="input" minlength="12" required autocomplete="new-password"></div>
      <div><label class="label" for="ar">Role</label><select id="ar" v-model="f.role" class="input"><option>admin</option><option>owner</option></select></div>
      <div class="sm:col-span-2"><button class="btn btn-accent">Add admin</button></div>
    </form>
    <div class="card overflow-x-auto"><table class="w-full text-sm min-w-[520px]"><thead><tr><th class="th">Name</th><th class="th">Email</th><th class="th">Role</th><th class="th">2FA</th><th class="th">Added</th><th class="th" /></tr></thead><tbody>
      <tr v-for="a in rows" :key="a.id"><td class="td font-medium">{{ a.name }}</td><td class="td">{{ a.email }}</td><td class="td"><span class="badge">{{ a.role }}</span></td><td class="td">{{ a.totpEnabled ? 'On' : 'Off' }}</td><td class="td">{{ fmtDate(a.createdAt) }}</td>
        <td class="td text-right"><button class="btn btn-danger" :aria-label="`Remove ${a.email}`" @click="del(a)">Remove</button></td></tr></tbody></table></div></div>
</template>
