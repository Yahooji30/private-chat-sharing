import type { H3Event } from 'h3'

export interface RssItem { slug: string; title: string; excerpt: string; publishedAt: string | null; category: { name: string } | null }

export const apiGet = <T>(event: H3Event, path: string): Promise<T> => $fetch(`${useRuntimeConfig(event).apiInternal}/api${path}`) as Promise<T>
export const siteOrigin = (event: H3Event): string => String(useRuntimeConfig(event).public.siteUrl).replace(/\/$/, '')
/** The address of the whole website, without the folder the blog may live in (https://example.com for https://example.com/blog): pictures are served from there. */
export const siteRoot = (event: H3Event): string => { const u = siteOrigin(event); try { return new URL(u).origin } catch { return u } }
export const xml = (s: string): string => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string)
