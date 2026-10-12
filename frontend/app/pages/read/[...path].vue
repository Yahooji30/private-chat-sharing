<script setup lang="ts">
/** The blog, features and FAQ pages shown inside the app window, so an installed PWA never leaves the app. */
const app = useApp()
const route = useRoute()
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const loaded = ref(false)
const origin = computed(() => { try { return new URL(app.blogUrl).origin } catch { return '' } })
const sub = computed(() => { const p = route.params.path; return `/${Array.isArray(p) ? p.join('/') : (p ?? '')}` })
// the iframe is only ever pointed at the blog once; later route changes would reload it, so keep the first src
const src = ref(`${app.blogUrl}${sub.value === '/' ? '/' : sub.value}`)
watch(sub, v => { if (frame.value?.contentWindow) { loaded.value = false; frame.value.src = `${app.blogUrl}${v}` } })
useHead({ title: 'Blog' })

const sendTheme = (): void => frame.value?.contentWindow?.postMessage({ jb: 'theme', dark: document.documentElement.classList.contains('dark') }, origin.value || '*')
useMutationObserver(() => (import.meta.client ? document.documentElement : null), sendTheme, { attributes: true, attributeFilter: ['class'] })
useEventListener(window, 'message', (e: MessageEvent) => {
  if (e.origin !== origin.value || e.data?.jb !== 'nav' || typeof e.data.path !== 'string' || !e.data.path.startsWith('/') || e.data.path.startsWith('//')) return
  void navigateTo(e.data.path)
})
function onLoad(): void { loaded.value = true; sendTheme() }
</script>

<template>
  <div class="fixed inset-x-0 top-14 md:top-16 lg:top-0 lg:left-64 bottom-0 bg-bg">
    <p v-if="!app.blogUrl" class="p-8 text-center text-muted">The blog address is not configured (NUXT_PUBLIC_BLOG_URL).</p>
    <template v-else>
      <div v-if="!loaded" class="absolute inset-0 grid place-items-center text-muted"><Icon name="refresh" class="animate-spin" /></div>
      <iframe ref="frame" :src="src" title="Blog" class="size-full border-0 bg-bg" :class="loaded ? '' : 'invisible'" @load="onLoad" />
    </template>
  </div>
</template>
