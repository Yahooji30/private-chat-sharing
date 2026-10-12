// When the app shows this site inside its own window, tell it which page we are on so its address bar and title follow along.
export default defineNuxtPlugin(nuxtApp => {
  if (window.top === window.self) return
  const router = useRouter()
  const send = (path: string): void => window.parent.postMessage({ jb: 'url', path, title: document.title }, '*')
  router.afterEach(to => { setTimeout(() => send(to.fullPath), 80) })
  nuxtApp.hook('app:mounted', () => setTimeout(() => send(router.currentRoute.value.fullPath), 80))
})
