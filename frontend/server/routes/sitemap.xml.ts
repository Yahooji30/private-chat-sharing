import { masterSitemap } from '../utils/sitemapmaster'

// the one sitemap for the whole website (site pages + blog files)
export default defineEventHandler(event => masterSitemap(event))
