// pm2 start deploy/ecosystem.config.cjs   (run from the repo root after `pnpm build`; behind deploy/nginx.conf)
const env = process.env
module.exports = {
  apps: [
    { name: 'sync-api', script: 'backend/dist/api.js', exec_mode: 'cluster', instances: 2, node_args: '--env-file=.env' },
    { name: 'sync-rt', script: 'backend/dist/rt.js', exec_mode: 'cluster', instances: 2, node_args: '--env-file=.env' },
    { name: 'sync-web', script: 'frontend/.output/server/index.mjs', exec_mode: 'cluster', instances: 2, env: { PORT: 3000, NUXT_API_INTERNAL: 'http://127.0.0.1:4000' } },
    { name: 'sync-blog', script: 'blog/.output/server/index.mjs', exec_mode: 'cluster', instances: 2, env: { PORT: 3001, NUXT_API_INTERNAL: 'http://127.0.0.1:4000', NUXT_REVALIDATE_SECRET: env.REVALIDATE_SECRET ?? '', NUXT_PUBLIC_SITE_URL: env.BLOG_PUBLIC_URL ?? '', NUXT_PUBLIC_APP_URL: env.PUBLIC_ORIGIN ?? '' } },
  ],
}
