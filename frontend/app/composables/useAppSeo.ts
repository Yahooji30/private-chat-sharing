import type { SeoEntry } from '@sync/shared'

/** Page tags the admin edited (Admin > SEO), keyed by page. Empty until loaded, then the head updates by itself. */
export const useSeoMap = () => useState<Record<string, SeoEntry>>('seo-map', () => ({}))

export async function loadSeo(): Promise<void> {
  try { useSeoMap().value = await api<Record<string, SeoEntry>>('/seo') } catch { /* the built-in tags stay */ }
}

/**
 * Title, description, social tags, robots, keywords and canonical for an app page. The admin's values win; `d` fills what they
 * left empty. Search engines get the same tags in the first HTML from the server (server/plugins/seo.ts); this keeps the
 * live document in step once the app has loaded.
 */
export function useAppSeo(key: string, d: { title: string; description?: string }): void {
  const map = useSeoMap()
  const blogUrl = useApp().blogUrl
  const s = computed(() => map.value[key])
  useSeoMeta({
    title: () => s.value?.title || d.title,
    description: () => s.value?.description || d.description,
    ogTitle: () => s.value?.ogTitle || s.value?.title || undefined,
    ogDescription: () => s.value?.ogDescription || s.value?.description || undefined,
    ogImage: () => (s.value?.ogImage && blogUrl ? `${blogUrl}${s.value.ogImage}` : undefined),
    robots: () => (s.value?.noindex ? 'noindex, nofollow' : undefined),
  })
  useHead({
    meta: computed(() => (s.value?.keywords ? [{ name: 'keywords', content: s.value.keywords }] : [])),
    link: computed(() => (s.value?.canonical ? [{ rel: 'canonical', href: s.value.canonical }] : [])),
  })
}
