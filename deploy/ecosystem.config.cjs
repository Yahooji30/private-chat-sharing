// Production: all apps, from the repo root after `pnpm build`:  pm2 start deploy/ecosystem.config.cjs
// Each app reads only its own .env (backend/.env, frontend/.env, blog/.env, admin/.env). Put nginx in front (deploy/nginx.conf).
const path = require('node:path')
const app = d => path.join(__dirname, '..', d)
module.exports = {
  apps: [
    { name: 'sync-api', script: 'dist/api.js', cwd: app('backend'), exec_mode: 'cluster', instances: 2, node_args: '--env-file=.env' },
    { name: 'sync-rt', script: 'dist/rt.js', cwd: app('backend'), exec_mode: 'cluster', instances: 2, node_args: '--env-file=.env' },
    { name: 'sync-web', script: '.output/server/index.mjs', cwd: app('frontend'), exec_mode: 'cluster', instances: 2, node_args: '--env-file=.env' },
    { name: 'sync-blog', script: '.output/server/index.mjs', cwd: app('blog'), node_args: '--env-file=.env' },
    { name: 'sync-admin', script: 'server.mjs', cwd: app('admin'), node_args: '--env-file=.env' },
  ],
}
