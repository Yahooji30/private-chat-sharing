/**
 * Addresses on this site. The blog normally sits at the root of its own address, but it can also be served under a folder of the main site
 * (NUXT_APP_BASE_URL=/blog/). Links made with <NuxtLink> follow that by themselves; plain addresses (feeds, images by hand) go through here.
 */
export const withBase = (path: string): string => {
  const base = useRuntimeConfig().app.baseURL
  return `${base.endsWith('/') ? base.slice(0, -1) : base}${path.startsWith('/') ? path : `/${path}`}`
}

/** The address of the whole website, without the folder: where /media and the other shared files live (https://example.com for https://example.com/blog). */
export const siteRoot = (): string => {
  const url = String(useRuntimeConfig().public.siteUrl)
  try { return new URL(url).origin } catch { return url.replace(/\/+$/, '') }
}
