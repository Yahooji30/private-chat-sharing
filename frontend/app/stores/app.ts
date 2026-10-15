import { DEFAULT_SETTINGS, LIMITS, type Settings } from '@sync/shared'

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
  const textMax = ref<number>(LIMITS.textChars) // the server's TEXT_MAX_CHARS, delivered with /space/me
  const cfg = useRuntimeConfig().public
  const rtUrl = ref(String(cfg.rtUrl ?? '').replace(/\/$/, ''))
  const blogUrl = ref(String(cfg.blogUrl ?? '').replace(/\/$/, ''))
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const peers = ref<Peer[]>([])
  const online = ref(false)
  const hasConnected = ref(false)
  const theme = ref<ThemePref>('light')
  const autoDownload = ref(true)
  const spellcheck = ref(false)
  const notify = ref(false)
  const settingsOpen = ref(false)
  const settingsTab = ref<'general' | 'link' | 'linked'>('general')

  function applyTheme(): void {
    const dark = theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    // the bars the phone draws around the page (status bar, and on Android the navigation bar) take the page's own colour, so no stripe shows
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.removeAttribute('media'); m.setAttribute('content', dark ? '#0A0E1C' : '#F7F8FC') })
  }
  function setTheme(t: ThemePref): void { theme.value = t; ls.set('theme', t); applyTheme() }
  function toggleTheme(): void { setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark') }

  async function load(): Promise<void> {
    theme.value = ls.get('theme', 'light') as ThemePref
    autoDownload.value = ls.get('autoDownload', '1') === '1'
    spellcheck.value = ls.get('spellcheck', '0') === '1'
    notify.value = ls.get('notify', '0') === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted'
    applyTheme()
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)
    const me = await api<{ device: Device; ip: string; settings: Settings; limits?: { textChars: number } }>('/space/me')
    device.value = me.device; ip.value = me.ip; settings.value = me.settings
    if (me.limits?.textChars) textMax.value = me.limits.textChars
    ready.value = true
  }

  async function saveSettings(s: Settings): Promise<void> {
    settings.value = await api<Settings>('/settings', { method: 'PUT', body: s })
  }
  function setLocal(k: 'autoDownload' | 'spellcheck', v: boolean): void {
    if (k === 'autoDownload') autoDownload.value = v; else spellcheck.value = v
    ls.set(k, v ? '1' : '0')
  }
  /** Turns notifications for files from your other devices on or off. The browser asks the person for permission the first time. */
  async function setNotify(v: boolean): Promise<boolean> {
    if (!v) { notify.value = false; ls.set('notify', '0'); return true }
    if (typeof Notification === 'undefined') return false
    const ok = Notification.permission === 'granted' || (Notification.permission !== 'denied' && (await Notification.requestPermission()) === 'granted')
    notify.value = ok; ls.set('notify', ok ? '1' : '0')
    return ok
  }
  /** shows a notification, but only while the app is not on screen (a message on screen is enough otherwise) */
  async function tell(title: string, body: string): Promise<void> {
    if (!notify.value || document.visibilityState === 'visible' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const opts = { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'jodbox' }
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return await reg.showNotification(title, opts); new Notification(title, opts) } catch { /* not allowed here */ }
  }
  async function rename(name: string): Promise<void> {
    await api('/device', { method: 'PATCH', body: { name } })
    if (device.value) device.value = { ...device.value, name }
  }
  function openSettings(tab: 'general' | 'link' | 'linked' = 'general'): void { settingsTab.value = tab; settingsOpen.value = true }

  return { ready, device, ip, textMax, rtUrl, blogUrl, settings, peers, online, hasConnected, theme, autoDownload, spellcheck, notify, setNotify, tell, settingsOpen, settingsTab, load, saveSettings, setLocal, rename, setTheme, toggleTheme, openSettings }
})
