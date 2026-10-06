import type { H3Event } from 'h3'

export interface SitemapData { articles: { slug: string; lastmod: string }[]; categories: string[]; tags: string[]; pages: { slug: string; lastmod: string }[] }
export interface RssItem { slug: string; title: string; excerpt: string; publishedAt: string | null; category: { name: string } | null }

export const apiGet = <T>(event: H3Event, path: string): Promise<T> => $fetch(`${useRuntimeConfig(event).apiInternal}/api${path}`) as Promise<T>
export const siteOrigin = (event: H3Event): string => String(useRuntimeConfig(event).public.siteUrl).replace(/\/$/, '')
export const xml = (s: string): string => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string)
