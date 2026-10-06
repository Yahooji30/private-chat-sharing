export interface Variant { w: number; h: number; path: string; bytes: number }
export interface Cover { id: string; alt: string; width: number; height: number; variants: Variant[] }
export interface Card { slug: string; title: string; excerpt: string; publishedAt: string | null; readingMin: number; category: { slug: string; name: string } | null; cover: Cover | null }
export interface ListResult { items: Card[]; total: number; page: number; pages: number }
export interface Article extends Card {
  html: string; toc: { id: string; text: string; level: 2 | 3 }[]; seoTitle: string; seoDescription: string; updatedAt: string
  author: string | null; tags: { slug: string; name: string }[]; related: Card[]; og: Cover | null
}

/** SSR-friendly public API read: server uses the internal API URL, the browser uses same-origin /api. */
export function useBlogFetch<T>(key: string, path: () => string) {
  const cfg = useRuntimeConfig()
  const hdr = import.meta.server ? useRequestHeaders(['x-forwarded-for']) : {}
  return useAsyncData<T>(key, () => $fetch(`${import.meta.server ? cfg.apiInternal : ''}/api${path()}`, { headers: hdr }) as Promise<T>, { watch: [() => path()] })
}

export const mediaUrl = (v: Variant): string => `/media/${v.path}`
export const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '')
