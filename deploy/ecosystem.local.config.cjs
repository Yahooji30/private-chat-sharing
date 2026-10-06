// Run the whole app on one PC with pm2 (no nginx). From the repo root, after `pnpm build`:
//   pm2 start deploy/ecosystem.local.config.cjs
// App (SPA): http://localhost:3000   Blog, public pages, legal (SSR): http://localhost:3001
// The browser finds the realtime service and the blog through RT_PUBLIC_URL and BLOG_PUBLIC_URL in .env.
module.exports = {
  apps: [
    { name: 'sync-api', script: 'backend/dist/api.js', node_args: '--env-file=.env' },
    { name: 'sync-rt', script: 'backend/dist/rt.js', node_args: '--env-file=.env' },
    { name: 'sync-web', script: 'frontend/.output/server/index.mjs', env: { PORT: 3000, NUXT_API_INTERNAL: 'http://127.0.0.1:4000' } },
    { name: 'sync-blog', script: 'blog/.output/server/index.mjs', env: { PORT: 3001, NUXT_API_INTERNAL: 'http://127.0.0.1:4000', NUXT_REVALIDATE_SECRET: 'dev-revalidate-secret', NUXT_PUBLIC_SITE_URL: 'http://localhost:3001', NUXT_PUBLIC_APP_URL: 'http://localhost:3000' } },
  ],
}
