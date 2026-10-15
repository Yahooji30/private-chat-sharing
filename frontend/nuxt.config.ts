import tailwindcss from '@tailwindcss/vite'

const appName = process.env.NUXT_PUBLIC_APP_NAME ?? 'Jodbox'
const isProd = process.env.NODE_ENV === 'production'
const rtUrl = process.env.NUXT_PUBLIC_RT_URL ?? ''
// Nuxt inlines its hydration payload, so scripts need 'unsafe-inline'. Everything else stays on this origin.
const adsOn = !!process.env.NUXT_PUBLIC_ADSENSE_CLIENT
const adHosts = 'https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google'
const csp = [
  "default-src 'self'", `script-src 'self' 'unsafe-inline'${adsOn ? ` ${adHosts}` : ''}`, "style-src 'self' 'unsafe-inline'", `img-src 'self' data: blob:${adsOn ? ' https:' : ''}`, "media-src 'self' blob:", "font-src 'self' data:",
  `connect-src 'self' ws: wss: ${rtUrl}${adsOn ? ` ${adHosts}` : ''}`.trim(), "worker-src 'self' blob:", `frame-src blob:${adsOn ? ` ${adHosts}` : ''}`, "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ')
const securityHeaders = { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()', 'X-Frame-Options': 'DENY' }

// The interactive app is a pure SPA (no server rendering). Blog, public pages and legal pages are the separate SSR site in ../blog.
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  // tailwind's plugin types come from a different vite copy; the cast is a type-only boundary
  vite: { plugins: [tailwindcss() as unknown as never] },
  runtimeConfig: {
    apiInternal: process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000',
    public: { appName, rtUrl: '', blogUrl: '', adsenseClient: '', adsEnabled: 'true', adsPreview: 'true', adSlotRail: '', adSlotInline: '', adSlotBanner: '' }, // NUXT_PUBLIC_RT_URL, NUXT_PUBLIC_BLOG_URL from frontend/.env
  },
  nitro: {
    noExternals: true, // bundle every dependency into .output so the server needs no node_modules (pnpm and Windows safe)
    prerender: { routes: ['/200.html'], failOnError: false },
    devProxy: { '/api': { target: 'http://127.0.0.1:4000/api', changeOrigin: false }, '/media': { target: 'http://127.0.0.1:4000/media', changeOrigin: false } },
  },
  routeRules: {
    ...(isProd ? { '/**': { headers: securityHeaders } } : {}),
    '/api/**': { proxy: `${process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000'}/api/**` },
    '/media/**': { proxy: `${process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000'}/media/**` },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        // the phone's bars follow the page colour (see applyTheme); these two are what they show before the app has started
        { name: 'theme-color', content: '#F7F8FC', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0A0E1C', media: '(prefers-color-scheme: dark)' },
        { name: 'description', content: `${appName}: type on one device, see it on every device on your network. Share text and files instantly, privately, with no sign-up.` },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/icons/favicon-48.png' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      ],
      script: [{ innerHTML: `try{var t=localStorage.getItem('sync:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);var m=document.querySelectorAll('meta[name=theme-color]');for(var i=0;i<m.length;i++){m[i].removeAttribute('media');m[i].setAttribute('content',d?'#0A0E1C':'#F7F8FC')}}catch(e){}` }],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: appName, short_name: appName, description: 'Instant text and file sharing across your devices.',
      theme_color: '#0A0E1C', background_color: '#0A0E1C', display: 'standalone', orientation: 'any', start_url: '/', scope: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      share_target: { action: '/?share=1', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
    },
    workbox: {
      navigateFallback: '/200.html', navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/media/],
      // the module lists the SPA shell as the clean url "200" which the server does not serve; precache the real file
      manifestTransforms: [entries => ({ manifest: entries.map(e => (e.url === '200' ? { ...e, url: '200.html' } : e)), warnings: [] })],
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      runtimeCaching: [{ urlPattern: ({ url }: { url: URL }) => /^\/api\/(space\/me|settings|text)$/.test(url.pathname), handler: 'NetworkFirst', options: { cacheName: 'api-meta', networkTimeoutSeconds: 3 } }],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },
})
