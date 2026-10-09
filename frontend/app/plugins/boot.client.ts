export default defineNuxtPlugin(async () => {
  const app = useApp()
  void loadSeo()
  try { await app.load() } catch { useToast().err('Cannot reach the server. Working offline.') }
  if (app.ready) spaceSocket()
})
