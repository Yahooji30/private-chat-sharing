<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import Icon from './components/Icon.vue'
import { ui } from './ui'
import { useAuth } from './stores/auth'

const auth = useAuth()
const route = useRoute()
const router = useRouter()
const open = ref(false)
const dark = ref(document.documentElement.classList.contains('dark'))
const nav = computed(() => [
  { to: '/', label: 'Dashboard', icon: 'dash' }, { to: '/articles', label: 'Articles', icon: 'file' }, { to: '/categories', label: 'Categories', icon: 'folder' }, { to: '/tags', label: 'Tags', icon: 'tag' },
  { to: '/library', label: 'Media', icon: 'image' }, { to: '/reports', label: 'Reports', icon: 'flag' }, { to: '/settings', label: 'Site settings', icon: 'cog' },
  ...(auth.me?.role === 'owner' ? [{ to: '/admins', label: 'Admins', icon: 'users' }] : []), { to: '/audit', label: 'Audit log', icon: 'list' }, { to: '/account', label: 'Account', icon: 'user' },
])
const active = (to: string): boolean => (to === '/' ? route.path === '/' : route.path.startsWith(to))
function theme(): void { dark.value = !dark.value; document.documentElement.classList.toggle('dark', dark.value); try { localStorage.setItem('admin:theme', dark.value ? 'dark' : 'light') } catch { /* private mode */ } }
async function logout(): Promise<void> { await auth.logout(); await router.push('/login') }
function answer(v: boolean): void { ui.dialog?.resolve(v); ui.dialog = null }
</script>

<template>
  <RouterView v-if="route.name === 'login' || !auth.me" />
  <div v-else class="min-h-dvh md:flex">
    <div v-if="open" class="fixed inset-0 bg-black/40 z-30 md:hidden" @click="open = false" />
    <aside class="fixed md:sticky top-0 z-40 h-dvh w-60 shrink-0 bg-surface border-r border-line flex flex-col transition-transform md:translate-x-0" :class="open ? '' : '-translate-x-full'">
      <div class="h-14 px-4 flex items-center gap-2 border-b border-line"><img src="/icon.svg" alt="" width="28" height="28" class="rounded-lg"><span class="font-bold">Admin</span></div>
      <nav class="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label="Admin">
        <RouterLink v-for="n in nav" :key="n.to" :to="n.to" class="flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm font-medium" :class="active(n.to) ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'" @click="open = false"><Icon :name="n.icon" />{{ n.label }}</RouterLink>
      </nav>
    </aside>
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="sticky top-0 z-20 h-14 bg-bg/90 backdrop-blur border-b border-line px-3 md:px-6 flex items-center gap-2">
        <button class="btn !px-2.5 md:hidden" aria-label="Menu" @click="open = true"><Icon name="menu" /></button>
        <span class="ml-auto text-sm text-muted hidden sm:block">{{ auth.me?.name }} <span class="badge">{{ auth.me?.role }}</span></span>
        <button class="btn !px-2.5" aria-label="Toggle theme" @click="theme"><Icon :name="dark ? 'sun' : 'moon'" /></button>
        <button class="btn" @click="logout"><Icon name="out" />Sign out</button>
      </header>
      <main class="flex-1 p-3 md:p-6 max-w-7xl w-full mx-auto"><RouterView /></main>
    </div>
  </div>

  <div class="fixed z-[60] top-3 right-3 left-3 sm:left-auto sm:w-96 space-y-2 pointer-events-none" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="card pointer-events-auto px-4 py-3 text-sm shadow-lg" :class="t.kind === 'err' ? 'border-accent text-accent-ink' : 'border-ok'" role="status">{{ t.text }}</div>
  </div>
  <div v-if="ui.dialog" class="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" :aria-label="ui.dialog.title" @keydown.esc="answer(false)">
    <div class="card w-full max-w-sm p-5 space-y-4"><h2 class="font-semibold text-lg">{{ ui.dialog.title }}</h2><p class="text-sm text-muted">{{ ui.dialog.text }}</p>
      <div class="flex justify-end gap-2"><button class="btn" @click="answer(false)">Cancel</button><button class="btn" :class="ui.dialog.danger ? 'btn-accent' : 'btn-accent'" data-testid="confirm-yes" @click="answer(true)">Confirm</button></div></div>
  </div>
</template>
