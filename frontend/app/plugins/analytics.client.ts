/**
 * Google Analytics 4 for the app. The measurement ID is the one entered in Admin > Site settings; with no ID nothing is loaded.
 * Private places are never reported: chat rooms (/c/...), the device-link page and a shared-text link carry secrets in the address,
 * so analytics is switched off while one of them is open. Other pages are reported without the part after the ?.
 * Visitors who send "Do Not Track" or "Global Privacy Control" are not measured.
 */
type Gtag = (...a: unknown[]) => void
export default defineNuxtPlugin(nuxtApp => {
  const app = useApp()
  const router = useRouter()
  let id = ''
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>
  const sensitive = (path: string, query: Record<string, unknown>): boolean => path.startsWith('/c/') || path === '/link' || 'share' in query

  function track(path: string, query: Record<string, unknown>): void {
    if (!id) return
    if (sensitive(path, query)) { w[`ga-disable-${id}`] = true; return }
    w[`ga-disable-${id}`] = navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
    setTimeout(() => w.gtag?.('event', 'page_view', { page_title: document.title, page_location: location.origin + path, page_path: path }), 60) // after the new page sets its title
  }

  function start(): void {
    if (id || !app.analyticsId) return
    id = app.analyticsId
    w.dataLayer = w.dataLayer || []
    // gtag needs the real `arguments` object, not an array
    w.gtag = function () { (w.dataLayer as unknown[]).push(arguments) }
    const here = router.currentRoute.value
    w[`ga-disable-${id}`] = sensitive(here.path, here.query) || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
    w.gtag('js', new Date())
    w.gtag('config', id, { send_page_view: false })
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
    document.head.appendChild(s)
    track(here.path, here.query)
    router.afterEach(to => track(to.path, to.query))
  }

  nuxtApp.hook('app:mounted', () => { watch(() => app.analyticsId, start, { immediate: true }) })
})
