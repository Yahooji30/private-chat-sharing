// Run the whole app on one PC with pm2 (no nginx). From the repo root, after `pnpm build`:
//   pm2 start deploy/ecosystem.local.config.cjs
// Open http://localhost:3000. The browser talks to the realtime service directly on :4001.
module.exports = {
  apps: [
    { name: 'sync-api', script: 'backend/dist/api.js', node_args: '--env-file=.env' },
    { name: 'sync-rt', script: 'backend/dist/rt.js', node_args: '--env-file=.env' },
    { name: 'sync-web', script: 'frontend/.output/server/index.mjs', env: { PORT: 3000, NUXT_REVALIDATE_SECRET: 'dev-revalidate-secret', NUXT_API_INTERNAL: 'http://127.0.0.1:4000' } },
  ],
}
