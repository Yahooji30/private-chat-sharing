import tailwindcss from '@tailwindcss/vite'

const appName = process.env.NUXT_PUBLIC_APP_NAME ?? 'Jodbox'
const isProd = process.env.NODE_ENV === 'production'
const api = process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000'
const adsOn = !!process.env.NUXT_PUBLIC_ADSENSE_CLIENT
const adHosts = 'https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google'
// Nuxt inlines its hydration payload, so scripts need 'unsafe-inline'. 
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${adsOn ? ` ${adHosts}` : ''}`, "style-src 'self' 'unsafe-inline'", `img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com${adsOn ? ' https:' : ''}`, "font-src 'self' data:", `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com${adsOn ? ` ${adHosts}` : ''}`, `frame-src 'self'${adsOn ? ` ${adHosts}` : ''}`, "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ')
const securityHeaders = { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' }
// The blog site is server rendered for search engines: the blog, the feedback page and the legal pages.
// The interactive app lives in the separate SPA (frontend/).
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss() as unknown as never] },
  runtimeConfig: {
    apiInternal: api,
    revalidateSecret: '', // set at runtime with NUXT_REVALIDATE_SECRET
    public: { appName, adsenseClient: '', adsEnabled: 'true', adsPreview: 'true', adSlotRail: '', adSlotInline: '', adSlotBanner: '', siteUrl: 'http://localhost:3001', appUrl: 'http://localhost:3000' }, // override with NUXT_PUBLIC_SITE_URL / NUXT_PUBLIC_APP_URL
  },
  nitro: {
    noExternals: true, // bundle every dependency into .output so the server needs no node_modules (pnpm and Windows safe)
    compressPublicAssets: true,
    devProxy: { '/api': { target: `${api}/api`, changeOrigin: false }, '/media': { target: `${api}/media`, changeOrigin: false } } },
  routeRules: {
    ...(isProd ? { '/**': { headers: securityHeaders } } : {}),
    '/blog': { redirect: '/' }, '/blog/**': { redirect: '/**' }, // old addresses
    '/': { swr: 600 }, '/*': { swr: 600 }, '/_revalidate': { cache: false }, '/rss.xml': { swr: 600 }, '/sitemap.xml': { swr: 600 }, '/sitemaps/**': { swr: 600 }, '/robots.txt': { cache: false }, '/category/**': { swr: 600 }, '/tag/**': { swr: 600 }, '/privacy': { swr: 86400 }, '/terms': { swr: 86400 },
    '/api/**': { proxy: `${api}/api/**` }, '/media/**': { proxy: `${api}/media/**` },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }, { name: 'theme-color', content: '#F7F8FC' }],
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
      script: [{ innerHTML: `try{var t=localStorage.getItem('sync:theme')||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',d?'#0A0E1C':'#F7F8FC')}catch(e){}` }],
    },
  },
})
