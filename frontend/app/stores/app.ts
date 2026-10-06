import { DEFAULT_SETTINGS, type Settings } from '@sync/shared'

export interface Device { id: string; name: string; type: string; linked: boolean }
export interface Peer { deviceId: string; name: string; type: string; self: boolean; since: number }
type ThemePref = 'system' | 'light' | 'dark'

const ls = {
  get: (k: string, d: string): string => { try { return localStorage.getItem(`sync:${k}`) ?? d } catch { return d } },
  set: (k: string, v: string): void => { try { localStorage.setItem(`sync:${k}`, v) } catch { /* storage blocked */ } },
}

export const useApp = defineStore('app', () => {
  const ready = ref(false)
  const device = ref<Device | null>(null)
  const ip = ref('')
  const rtUrl = ref('')
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const peers = ref<Peer[]>([])
  const online = ref(false)
  const hasConnected = ref(false)
  const theme = ref<ThemePref>('system')
  const autoDownload = ref(true)
  const spellcheck = ref(false)
  const settingsOpen = ref(false)
  const settingsTab = ref<'general' | 'link' | 'linked'>('general')

  function applyTheme(): void {
    const dark = theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111113' : '#e85a5a')
  }
  function setTheme(t: ThemePref): void { theme.value = t; ls.set('theme', t); applyTheme() }
  function toggleTheme(): void { setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark') }

  async function load(): Promise<void> {
    theme.value = ls.get('theme', 'system') as ThemePref
    autoDownload.value = ls.get('autoDownload', '1') === '1'
    spellcheck.value = ls.get('spellcheck', '0') === '1'
    applyTheme()
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
    const me = await api<{ device: Device; ip: string; rtUrl: string; settings: Settings }>('/space/me')
    device.value = me.device; ip.value = me.ip; rtUrl.value = me.rtUrl; settings.value = me.settings
    ready.value = true
  }

  async function saveSettings(s: Settings): Promise<void> {
    settings.value = await api<Settings>('/settings', { method: 'PUT', body: s })
  }
  function setLocal(k: 'autoDownload' | 'spellcheck', v: boolean): void {
    if (k === 'autoDownload') autoDownload.value = v; else spellcheck.value = v
    ls.set(k, v ? '1' : '0')
  }
  async function rename(name: string): Promise<void> {
    await api('/device', { method: 'PATCH', body: { name } })
    if (device.value) device.value = { ...device.value, name }
  }
  function openSettings(tab: 'general' | 'link' | 'linked' = 'general'): void { settingsTab.value = tab; settingsOpen.value = true }

  return { ready, device, ip, rtUrl, settings, peers, online, hasConnected, theme, autoDownload, spellcheck, settingsOpen, settingsTab, load, saveSettings, setLocal, rename, setTheme, toggleTheme, openSettings }
})
