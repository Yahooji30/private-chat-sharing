import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api'

export interface Me { id: string; email: string; name: string; role: 'owner' | 'admin'; totpEnabled: boolean }

export const useAuth = defineStore('auth', () => {
  const me = ref<Me | null>(null)
  const loaded = ref(false)
  async function load(): Promise<void> {
    try { me.value = await api<Me>('/admin/auth/me') } catch { me.value = null }
    loaded.value = true
  }
  async function logout(): Promise<void> { await api('/admin/auth/logout', { method: 'POST' }).catch(() => undefined); me.value = null }
  return { me, loaded, load, logout }
})
