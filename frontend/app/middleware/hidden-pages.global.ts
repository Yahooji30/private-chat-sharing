/** A page the admin switched off (Admin > Site settings > Pages) cannot be opened, not even by its address: the visitor lands on the home page. */
export default defineNuxtRouteMiddleware(to => {
  const off = useApp().hiddenPages as string[]
  if (!off.length) return
  const p = to.path
  const hidden = (off.includes('chat') && (p === '/chat' || p.startsWith('/chat/') || p.startsWith('/c/')))
    || (off.includes('blog') && (p === '/blog' || p.startsWith('/blog/')))
    || (off.includes('features') && p === '/features')
    || (off.includes('faq') && p === '/faq')
  if (hidden) return navigateTo('/', { replace: true })
})
