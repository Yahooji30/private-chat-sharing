<script setup lang="ts">
import { gaMeasurementId } from '@sync/shared'

/**
 * Google Analytics 4 for the blog. The measurement ID is the one entered in Admin > Site settings; with no ID nothing is loaded.
 * The small set-up code is part of the server-rendered page and queues every event; Google's own script (177 KiB, a big part of a phone's
 * loading time) is fetched later: on the visitor's first touch, scroll or key press, or 4 seconds after the page has loaded, whichever comes first.
 * Queued events are sent when it arrives. Page views are sent by hand, because the blog changes pages without reloading. Visitors who send "Do Not Track" or "Global Privacy Control" are not measured.
 */
const { data } = await useBlogFetch<Record<string, string>>('site-config', () => '/site')
const id = gaMeasurementId(data.value?.analytics_id)
if (id) {
  useHead({
    script: [
      { innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl)window['ga-disable-${id}']=true;gtag('js',new Date());gtag('config','${id}',{send_page_view:false});` },
    ],
  })
}

const router = useRouter()
function pageView(): void {
  const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag
  if (!id || !g) return
  g('event', 'page_view', { page_title: document.title, page_location: location.origin + location.pathname + location.search, page_path: location.pathname })
}
function loadGoogleScript(): void {
  if (document.querySelector('script[data-gtag]')) return
  const s = document.createElement('script')
  s.async = true
  s.dataset.gtag = '1'
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(s)
}
function loadWhenSettled(): void {
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
  const go = (): void => { events.forEach(e => removeEventListener(e, go)); clearTimeout(timer); loadGoogleScript() }
  const timer = setTimeout(go, 4000)
  events.forEach(e => addEventListener(e, go, { once: true, passive: true }))
}
onMounted(() => {
  if (!id) return
  if (document.readyState === 'complete') loadWhenSettled(); else addEventListener('load', loadWhenSettled, { once: true })
  pageView()
  router.afterEach((_to, from) => { if (from.matched.length) setTimeout(pageView, 60) }) // wait for the new page's title
})
</script>

<template><span hidden /></template>
