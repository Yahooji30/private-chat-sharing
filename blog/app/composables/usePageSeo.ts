import type { SeoEntry } from '@sync/shared'

/** One JSON-LD <script> tag. `<` is escaped so text inside the data can never close the tag early. */
export const jsonLd = (data: unknown): { type: 'application/ld+json'; innerHTML: string } => ({ type: 'application/ld+json', innerHTML: JSON.stringify(data).replace(/</g, '\\u003c') })

interface Defaults {
  title: string
  description: string
  /** path on this site, with the query string for paged lists */
  path: string
  /** structured data to add besides the standard tags */
  schema?: unknown[]
  /** false: ignore the admin's canonical override (paged lists must canonicalise to themselves) */
  adminCanonical?: boolean
}

/**
 * Title, description, social tags, robots, canonical and keywords for a page. The admin's values (Admin > SEO, key = `key`)
 * win; the built-in defaults fill whatever the admin left empty. Runs on the server, so crawlers get the final tags.
 */
export async function usePageSeo(key: string, d: Defaults): Promise<SeoEntry | undefined> {
  const nuxt = useNuxtApp()
  const cfg = useRuntimeConfig()
  const origin = String(cfg.public.siteUrl).replace(/\/$/, '')
  const { data } = await useBlogFetch<Record<string, SeoEntry>>('seo', () => '/seo')
  const s = data.value?.[key]
  const title = s?.title || d.title
  const description = s?.description || d.description
  const url = (d.adminCanonical !== false && s?.canonical) || `${origin}${d.path}`
  const ogImage = s?.ogImage ? `${origin}${s.ogImage}` : undefined
  // head composables need the Nuxt context, which is gone after the await above
  nuxt.runWithContext(() => {
    useSeoMeta({
      title, description, ogTitle: s?.ogTitle || title, ogDescription: s?.ogDescription || description, ogType: 'website', ogUrl: url,
      ogSiteName: String(cfg.public.appName), ogImage, twitterCard: ogImage ? 'summary_large_image' : 'summary', robots: s?.noindex ? 'noindex, nofollow' : undefined,
    })
    useHead({
      meta: s?.keywords ? [{ name: 'keywords', content: s.keywords }] : [],
      link: [{ rel: 'canonical', href: url }],
      script: (d.schema ?? []).map(jsonLd),
    })
  })
  return s
}
