export interface Variant { w: number; h: number; path: string; bytes: number }
export interface Cover { id: string; alt: string; width: number; height: number; variants: Variant[] }
export interface Card { slug: string; title: string; excerpt: string; publishedAt: string | null; readingMin: number; category: { slug: string; name: string } | null; cover: Cover | null }
export interface ListResult { items: Card[]; total: number; page: number; pages: number }
export interface Article extends Card {
  html: string; toc: { id: string; text: string; level: 2 | 3 }[]; seoTitle: string; seoDescription: string; updatedAt: string
  author: string | null; tags: { slug: string; name: string }[]; related: Card[]; og: Cover | null
}
export const mediaUrl = (v: Variant): string => `/media/${v.path}`
export const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '')
/** The blog is read inside the app (no iframe), straight from the public blog API. The server-rendered copy on the blog site is what search engines index. */
export const useBlogData = <T>(key: string, path: () => string) => useAsyncData<T>(key, () => api<T>(path()), { watch: [() => path()] })
