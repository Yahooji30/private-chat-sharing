import { createRouter, createWebHistory } from 'vue-router'
import { setUnauthorizedHandler } from './api'
import { useAuth } from './stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('./pages/Login.vue'), meta: { public: true } },
  { path: '/', name: 'dashboard', component: () => import('./pages/Dashboard.vue') },
  { path: '/articles', name: 'articles', component: () => import('./pages/Articles.vue') },
  { path: '/articles/:id', name: 'article', component: () => import('./pages/ArticleEdit.vue') },
  { path: '/categories', name: 'categories', component: () => import('./pages/Taxonomy.vue'), props: { kind: 'categories' } },
  { path: '/tags', name: 'tags', component: () => import('./pages/Taxonomy.vue'), props: { kind: 'tags' } },
  { path: '/library', name: 'media', component: () => import('./pages/Media.vue') },
  { path: '/reports', name: 'reports', component: () => import('./pages/Reports.vue') },
  { path: '/ads', name: 'ads', component: () => import('./pages/Ads.vue') },
  { path: '/settings', name: 'settings', component: () => import('./pages/Settings.vue') },
  { path: '/admins', name: 'admins', component: () => import('./pages/Admins.vue'), meta: { owner: true } },
  { path: '/audit', name: 'audit', component: () => import('./pages/Audit.vue') },
  { path: '/account', name: 'account', component: () => import('./pages/Account.vue') },
  { path: '/:rest(.*)*', redirect: '/' },
]

export const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async to => {
  const auth = useAuth()
  if (!auth.loaded) await auth.load()
  if (!to.meta.public && !auth.me) return { name: 'login', query: to.fullPath === '/' ? {} : { next: to.fullPath } }
  if (to.meta.public && auth.me) return { name: 'dashboard' }
  if (to.meta.owner && auth.me?.role !== 'owner') return { name: 'dashboard' }
})

export function wireUnauthorized(): void {
  setUnauthorizedHandler(() => { useAuth().me = null; void router.push({ name: 'login', query: { next: router.currentRoute.value.fullPath } }) })
}
