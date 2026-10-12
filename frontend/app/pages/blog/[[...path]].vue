<script setup lang="ts">
/**
 * Blog, features, FAQ, feedback, privacy and terms are the separate server-rendered SEO site. Here they open inside the app window
 * (so an installed PWA never jumps to a browser tab) under clean addresses: /blog, /blog/<article>, /features, /faq ...
 * The real, indexable pages live on the blog site; this shell points search engines there with a canonical link.
 */
definePageMeta({ key: 'site-frame' })
const app = useApp()
const route = useRoute()
const router = useRouter()
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const loaded = ref(false)
const slow = ref(false)
const SITE = ['/features', '/faq', '/feedback', '/privacy', '/terms']
const toSite = (appPath: string): string => (appPath === '/blog' || appPath.startsWith('/blog/') || appPath.startsWith('/blog?') ? appPath.slice(5) || '/' : appPath)
const toApp = (sitePath: string): string => (SITE.some(p => sitePath === p || sitePath.startsWith(`${p}?`)) ? sitePath : sitePath === '/' ? '/blog' : `/blog${sitePath}`)
const origin = computed(() => { try { return new URL(app.blogUrl).origin } catch { return '' } })
const direct = (p: string): string => `${app.blogUrl}${p}`
const src = ref(direct(toSite(route.fullPath)))
let fromFrame = ''

useHead(() => ({ link: [{ rel: 'canonical', href: direct(toSite(route.path)) }] }))
let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => { timer = setTimeout(() => { slow.value = !loaded.value }, 7000) })
onBeforeUnmount(() => clearTimeout(timer))

watch(() => route.fullPath, v => {
  const site = toSite(v)
  if (site === fromFrame) return // the change came from inside the frame
  if (frame.value) { loaded.value = false; frame.value.src = direct(site) }
})
const sendTheme = (): void => frame.value?.contentWindow?.postMessage({ jb: 'theme', dark: document.documentElement.classList.contains('dark') }, '*')
useMutationObserver(() => (import.meta.client ? document.documentElement : null), sendTheme, { attributes: true, attributeFilter: ['class'] })
useEventListener(window, 'message', (e: MessageEvent) => {
  if (e.source !== frame.value?.contentWindow || !e.data || typeof e.data.path !== 'string' || !e.data.path.startsWith('/') || e.data.path.startsWith('//')) return
  if (e.data.jb === 'nav') { void navigateTo(e.data.path); return }
  if (e.data.jb === 'url') {
    fromFrame = e.data.path
    if (typeof e.data.title === 'string' && e.data.title) document.title = e.data.title
    const next = toApp(e.data.path)
    if (next !== route.fullPath) void router.replace(next)
    loaded.value = true
  }
})
function onLoad(): void { loaded.value = true; slow.value = false; sendTheme() }
</script>

<template>
  <div class="fixed inset-x-0 top-14 md:top-16 lg:top-0 lg:left-64 bottom-0 bg-bg">
    <p v-if="!app.blogUrl" class="p-8 text-center text-muted">The site address is not configured (NUXT_PUBLIC_BLOG_URL).</p>
    <template v-else>
      <div v-if="!loaded" class="absolute inset-0 grid place-items-center text-muted"><div class="text-center"><Icon name="refresh" class="animate-spin mx-auto" :size="22" />
        <p v-if="slow" class="mt-4 text-sm">Taking too long? <a :href="direct(toSite(route.fullPath))" class="text-accent-ink underline font-medium">Open this page directly</a></p></div></div>
      <iframe ref="frame" :src="src" title="Jodbox site" class="size-full border-0 bg-bg" :class="loaded ? '' : 'invisible'" @load="onLoad" />
    </template>
  </div>
</template>
