<script setup lang="ts">
import { gaMeasurementId } from '@sync/shared'

/**
 * Google Analytics 4 for the blog. The measurement ID is the one entered in Admin > Site settings; with no ID nothing is loaded.
 * The tag is part of the server-rendered page, so Google (and its "is the tag installed" check) sees it at once. Page views are sent
 * by hand, because the blog changes pages without reloading. Visitors who send "Do Not Track" or "Global Privacy Control" are not measured.
 */
const { data } = await useBlogFetch<Record<string, string>>('site-config', () => '/site')
const id = gaMeasurementId(data.value?.analytics_id)
if (id) {
  useHead({
    script: [
      { src: `https://www.googletagmanager.com/gtag/js?id=${id}`, async: true },
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
onMounted(() => {
  if (!id) return
  pageView()
  router.afterEach((_to, from) => { if (from.matched.length) setTimeout(pageView, 60) }) // wait for the new page's title
})
</script>

<template><span hidden /></template>
