// pm2 start deploy/ecosystem.config.cjs   (run from the repo root after `pnpm build`)
module.exports = {
  apps: [
    { name: 'sync-api', script: 'backend/dist/api.js', exec_mode: 'cluster', instances: 2, node_args: '--env-file=.env' },
    { name: 'sync-rt', script: 'backend/dist/rt.js', exec_mode: 'cluster', instances: 2, node_args: '--env-file=.env' },
    { name: 'sync-web', script: 'frontend/.output/server/index.mjs', exec_mode: 'cluster', instances: 2, env: { PORT: 3000, NUXT_PUBLIC_RT_URL: '' } },
  ],
}
