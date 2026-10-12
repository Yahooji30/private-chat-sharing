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
const groups = computed(() => [
  { label: '', items: [{ to: '/', label: 'Dashboard', icon: 'dash' }] },
  { label: 'Content', items: [{ to: '/articles', label: 'Articles', icon: 'file' }, { to: '/categories', label: 'Categories', icon: 'folder' }, { to: '/tags', label: 'Tags', icon: 'tag' }, { to: '/library', label: 'Media', icon: 'image' }] },
  { label: 'Visitors', items: [{ to: '/faqs', label: 'FAQ', icon: 'help' }, { to: '/feedback', label: 'Feedback', icon: 'inbox' }] },
  { label: 'Site', items: [{ to: '/seo', label: 'SEO', icon: 'search' }, { to: '/settings', label: 'Site settings', icon: 'cog' }] },
  { label: 'System', items: [...(auth.me?.role === 'owner' ? [{ to: '/admins', label: 'Admins', icon: 'users' }] : []), { to: '/audit', label: 'Audit log', icon: 'list' }, { to: '/account', label: 'Account', icon: 'user' }] },
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
    <aside class="fixed md:sticky top-0 z-40 h-dvh w-64 shrink-0 bg-surface border-r border-line flex flex-col transition-transform md:translate-x-0" :class="open ? '' : '-translate-x-full'">
      <div class="px-5 pt-5 pb-4"><img src="/logo.webp" alt="Jodbox" height="40" width="162" class="h-10 w-auto"><p class="eyebrow mt-2">Admin panel</p></div>
      <nav class="flex-1 overflow-y-auto px-3 pb-3 space-y-4" aria-label="Admin">
        <div v-for="g in groups" :key="g.label || 'top'">
          <p v-if="g.label" class="eyebrow px-3 mb-1.5">{{ g.label }}</p>
          <RouterLink v-for="n in g.items" :key="n.to" :to="n.to" class="flex items-center gap-3 px-3 h-10 rounded-lg text-[0.9375rem] font-medium transition-colors" :class="active(n.to) ? 'bg-accent-soft text-accent-ink' : 'text-ink/70 hover:bg-surface-2 hover:text-ink'" @click="open = false">
            <Icon :name="n.icon" :size="20" :weight="active(n.to) ? 'fill' : 'regular'" />{{ n.label }}</RouterLink>
        </div>
      </nav>
      <div class="p-3 border-t border-line"><div class="flex items-center gap-3 px-2 py-2"><span class="size-9 rounded-full bg-[var(--blue)] text-white grid place-items-center font-semibold text-sm shrink-0">{{ (auth.me?.name || '?').slice(0, 1).toUpperCase() }}</span>
        <div class="min-w-0"><p class="text-sm font-medium truncate leading-tight">{{ auth.me?.name }}</p><p class="text-xs text-muted capitalize">{{ auth.me?.role }}</p></div></div></div>
    </aside>
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="sticky top-0 z-20 h-14 bg-bg/90 backdrop-blur border-b border-line px-3 md:px-6 flex items-center gap-2">
        <button class="btn !px-2.5 md:hidden" aria-label="Menu" @click="open = true"><Icon name="menu" /></button>
        <img src="/logo-mark.webp" alt="" class="h-7 w-auto md:hidden" height="28" width="40">
        <span class="ml-auto" />
        <a href="/" class="btn hidden sm:inline-flex" target="_blank" rel="noopener" data-testid="view-site"><Icon name="external" :size="16" />View site</a>
        <button class="btn !px-2.5" aria-label="Toggle theme" @click="theme"><Icon :name="dark ? 'sun' : 'moon'" /></button>
        <button class="btn" @click="logout"><Icon name="out" />Sign out</button>
      </header>
      <main class="flex-1 p-3 md:p-6 max-w-7xl w-full mx-auto"><RouterView /></main>
    </div>
  </div>

  <div class="fixed z-[60] top-3 right-3 left-3 sm:left-auto sm:w-96 space-y-2 pointer-events-none" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="pointer-events-auto flex items-start gap-3 bg-surface border rounded-xl px-4 py-3 text-sm shadow-card" :class="t.kind === 'err' ? 'border-pink/50' : 'border-ok/50'" role="status">
      <Icon :name="t.kind === 'err' ? 'err' : 'ok'" :size="20" weight="fill" :class="t.kind === 'err' ? 'text-pink' : 'text-ok'" /><span class="min-w-0 break-words">{{ t.text }}</span></div>
  </div>
  <div v-if="ui.dialog" class="fixed inset-0 z-[70] grid place-items-center p-4" role="alertdialog" aria-modal="true" :aria-label="ui.dialog.title" @keydown.esc="answer(false)">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="answer(false)" />
    <div class="relative w-full max-w-sm bg-surface border border-line rounded-2xl shadow-card p-5">
      <div class="flex items-start gap-3"><span class="size-10 rounded-xl grid place-items-center shrink-0" :class="ui.dialog.danger ? 'bg-pink-soft text-pink-ink' : 'bg-accent-soft text-accent-ink'"><Icon :name="ui.dialog.danger ? 'trash' : 'warn'" :size="20" weight="bold" /></span>
        <div class="min-w-0"><h2 class="font-semibold leading-snug">{{ ui.dialog.title }}</h2><p class="text-sm text-muted mt-1 leading-relaxed">{{ ui.dialog.text }}</p></div></div>
      <div class="flex justify-end gap-2 mt-5"><button class="btn" @click="answer(false)">Cancel</button><button class="btn" :class="ui.dialog.danger ? 'btn-pink' : 'btn-accent'" data-testid="confirm-yes" @click="answer(true)">Confirm</button></div>
    </div>
  </div>
</template>
