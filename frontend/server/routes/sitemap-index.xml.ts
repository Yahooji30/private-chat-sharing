import { masterSitemap } from '../utils/sitemapmaster'

// same as /sitemap.xml, kept for the address that was handed out earlier
export default defineEventHandler(event => masterSitemap(event))
