import tailwindcss from '@tailwindcss/vite'

const appName = process.env.NUXT_PUBLIC_APP_NAME ?? 'Sync'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  // tailwind's plugin types come from a different vite copy; the cast is a type-only boundary
  vite: { plugins: [tailwindcss() as unknown as never] },
  runtimeConfig: {
    apiInternal: process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000',
    public: { appName, rtUrl: '', siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000' },
    revalidateSecret: process.env.REVALIDATE_SECRET ?? '',
  },
  nitro: { prerender: { routes: ['/'], failOnError: false }, devProxy: { '/api': { target: 'http://127.0.0.1:4000/api', changeOrigin: false }, '/media': { target: 'http://127.0.0.1:4000/media', changeOrigin: false } } },
  routeRules: {
    '/': { ssr: false },
    '/settings': { ssr: false }, '/public/**': { ssr: false }, '/link': { ssr: false }, '/chat': { ssr: false }, '/c/**': { ssr: false },
    '/p/**': { swr: 300 },
    '/blog/**': { swr: 600 }, '/blog': { swr: 600 }, '/privacy': { swr: 86400 }, '/terms': { swr: 86400 },
    '/media/**': { proxy: `${process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000'}/media/**` },
    '/api/**': { proxy: `${process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000'}/api/**` },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#e85a5a' },
        { name: 'description', content: `${appName}: type on one device, see it on every device on your network. Share text and files instantly, privately, with no sign-up.` },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      ],
      script: [{ innerHTML: `try{var t=localStorage.getItem('sync:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}` }],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: appName, short_name: appName, description: 'Instant text and file sharing across your devices.',
      theme_color: '#e85a5a', background_color: '#fafafa', display: 'standalone', orientation: 'any', start_url: '/', scope: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      share_target: { action: '/?share=1', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
    },
    workbox: {
      navigateFallback: '/', navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      runtimeCaching: [{ urlPattern: ({ url }: { url: URL }) => /^\/api\/(space\/me|settings|text)$/.test(url.pathname), handler: 'NetworkFirst', options: { cacheName: 'api-meta', networkTimeoutSeconds: 3 } }],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },
})
