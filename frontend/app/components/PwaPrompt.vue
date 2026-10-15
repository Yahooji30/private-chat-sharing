<script setup lang="ts">
/**
 * Offers to install the app to the home screen (Android and desktop Chrome/Edge use the browser's own install; iPhone and iPad get the
 * "Add to Home Screen" steps), and keeps an open app on the newest version: the browser is asked for a new version every 30 minutes
 * and whenever the app comes back to the front, and the page reloads by itself once the new version is in place.
 */
interface Pwa { showInstallPrompt?: boolean; isPWAInstalled?: boolean; install?: () => Promise<void>; cancelInstall?: () => void; getSWRegistration?: () => ServiceWorkerRegistration | undefined }
const app = useApp()
const pwa = (useNuxtApp().$pwa ?? {}) as Pwa
const HIDE = 'sync:pwaHide'
const mounted = ref(false)
const late = ref(false)
const hidden = ref(false)
const ios = ref(false)
const installed = ref(false)

function snoozed(): boolean { try { return Number(localStorage.getItem(HIDE) ?? 0) > Date.now() } catch { return false } }
function snooze(days: number): void { try { localStorage.setItem(HIDE, String(Date.now() + days * 86_400_000)) } catch { /* storage blocked */ } hidden.value = true }

const canInstall = computed(() => !!pwa.showInstallPrompt && !installed.value)
const show = computed(() => mounted.value && late.value && app.ready && !hidden.value && !installed.value && (canInstall.value || ios.value))

async function install(): Promise<void> {
  try { await pwa.install?.() } catch { /* the person closed the browser's own install window */ }
  snooze(7)
}
function later(): void { pwa.cancelInstall?.(); snooze(14) }

function checkForUpdate(): void { void pwa.getSWRegistration?.()?.update().catch(() => undefined) }

onMounted(() => {
  mounted.value = true
  const ua = navigator.userAgent
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  installed.value = standalone || !!pwa.isPWAInstalled
  ios.value = /iPhone|iPad|iPod/i.test(ua) && !standalone
  hidden.value = snoozed()
  setTimeout(() => { late.value = true }, 8000) // let the person see the app first
  window.addEventListener('appinstalled', () => { installed.value = true })
  const timer = setInterval(checkForUpdate, 30 * 60_000)
  const visible = (): void => { if (document.visibilityState === 'visible') checkForUpdate() }
  document.addEventListener('visibilitychange', visible)
  onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('visibilitychange', visible) })
})
</script>

<template>
  <Transition name="pwa">
    <aside v-if="show" class="fixed z-40 inset-x-3 bottom-[calc(4.75rem+var(--safe-b))] lg:inset-x-auto lg:right-5 lg:bottom-5 lg:w-96 card p-4 shadow-xl" role="dialog" aria-label="Install Jodbox" data-testid="pwa-prompt">
      <div class="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" class="size-11 rounded-xl shrink-0">
        <div class="min-w-0 flex-1">
          <p class="font-semibold leading-tight">Install Jodbox</p>
          <p v-if="canInstall" class="text-sm text-muted mt-1">Open it from your home screen like an app, share files faster, and always get the latest version.</p>
          <p v-else class="text-sm text-muted mt-1">Tap <strong class="text-ink">Share</strong> <span aria-hidden="true">(the square with an arrow)</span>, then <strong class="text-ink">Add to Home Screen</strong>.</p>
        </div>
        <button class="btn !px-2 !min-h-8 shrink-0" aria-label="Close" @click="later"><Icon name="x" :size="15" /></button>
      </div>
      <div class="mt-3 flex gap-2">
        <button v-if="canInstall" class="btn btn-accent !min-h-10 flex-1" data-testid="pwa-install" @click="install"><Icon name="download" :size="16" />Install app</button>
        <button class="btn !min-h-10" :class="canInstall ? '' : 'flex-1'" @click="later">{{ canInstall ? 'Not now' : 'Got it' }}</button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.pwa-enter-active, .pwa-leave-active { transition: opacity .2s, transform .2s; }
.pwa-enter-from, .pwa-leave-to { opacity: 0; transform: translateY(12px); }
</style>
