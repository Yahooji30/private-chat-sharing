import tailwindcss from '@tailwindcss/vite'

const appName = process.env.NUXT_PUBLIC_APP_NAME ?? 'Jodbox'
const isProd = process.env.NODE_ENV === 'production'
const api = process.env.NUXT_API_INTERNAL ?? 'http://127.0.0.1:4000'
const appOrigin = (process.env.NUXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const appOrigins = [appOrigin, appOrigin.replace('//localhost', '//127.0.0.1')].filter((v, n, a) => a.indexOf(v) === n).join(' ')
const adsOn = !!process.env.NUXT_PUBLIC_ADSENSE_CLIENT
const adHosts = 'https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google'
// Nuxt inlines its hydration payload, so scripts need 'unsafe-inline'. The app origin may frame the blog (the app shows it inside its own window).
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline'${adsOn ? ` ${adHosts}` : ''}`, "style-src 'self' 'unsafe-inline'", `img-src 'self' data: blob:${adsOn ? ' https:' : ''}`, "font-src 'self' data:", `connect-src 'self'${adsOn ? ` ${adHosts}` : ''}`, `frame-src 'self'${adsOn ? ` ${adHosts}` : ''}`, "object-src 'none'", "base-uri 'self'", "form-action 'self'", `frame-ancestors 'self' ${appOrigins}`].join('; ')
const securityHeaders = { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' }
// Inside the app's window the blog drops its own header/footer, follows the app theme and hands app links back to the app.
const embedScript = `try{if(top!==self){var h=document.documentElement;h.classList.add('embedded');var A=${JSON.stringify(appOrigin)};addEventListener('message',function(e){if(e.source===parent&&e.data&&e.data.jb==='theme')h.classList.toggle('dark',!!e.data.dark)});document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey)return;var u=new URL(a.href,location.href);if(u.origin===A){e.preventDefault();parent.postMessage({jb:'nav',path:u.pathname+u.search},'*')}},true)}}catch(e){}`

// The blog site is server rendered for search engines: blog, features, FAQ and the legal pages.
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
    public: { appName, adsenseClient: '', adsPreview: 'true', adSlotRail: '', adSlotInline: '', adSlotBanner: '', siteUrl: 'http://localhost:3001', appUrl: 'http://localhost:3000' }, // override with NUXT_PUBLIC_SITE_URL / NUXT_PUBLIC_APP_URL
  },
  nitro: {
    noExternals: true, // bundle every dependency into .output so the server needs no node_modules (pnpm and Windows safe)
    compressPublicAssets: true,
    devProxy: { '/api': { target: `${api}/api`, changeOrigin: false }, '/media': { target: `${api}/media`, changeOrigin: false } } },
  routeRules: {
    ...(isProd ? { '/**': { headers: securityHeaders } } : {}),
    '/blog': { redirect: '/' }, '/blog/**': { redirect: '/**' }, // old addresses
    '/': { swr: 600 }, '/*': { swr: 600 }, '/_revalidate': { cache: false }, '/rss.xml': { swr: 600 }, '/sitemap.xml': { swr: 600 }, '/robots.txt': { cache: false }, '/category/**': { swr: 600 }, '/tag/**': { swr: 600 }, '/privacy': { swr: 86400 }, '/terms': { swr: 86400 },
    '/api/**': { proxy: `${api}/api/**` }, '/media/**': { proxy: `${api}/media/**` },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }, { name: 'theme-color', content: '#0058F0' }],
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
      script: [{ innerHTML: embedScript }, { innerHTML: `try{var t=localStorage.getItem('sync:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}` }],
    },
  },
})
