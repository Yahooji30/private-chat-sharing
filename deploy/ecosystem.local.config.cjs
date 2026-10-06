// Optional shortcut: start all apps from the repo root. Each app still uses only its own folder and its own .env.
// Normally start them one by one instead: cd backend && pm2 start ecosystem.config.cjs (same in frontend, blog, admin).
const path = require('node:path')
const app = d => path.join(__dirname, '..', d)
module.exports = {
  apps: [
    { name: 'sync-api', script: 'dist/api.js', cwd: app('backend'), node_args: '--env-file=.env' },
    { name: 'sync-rt', script: 'dist/rt.js', cwd: app('backend'), node_args: '--env-file=.env' },
    { name: 'sync-web', script: '.output/server/index.mjs', cwd: app('frontend'), node_args: '--env-file=.env' },
    { name: 'sync-blog', script: '.output/server/index.mjs', cwd: app('blog'), node_args: '--env-file=.env' },
    { name: 'sync-admin', script: 'server.mjs', cwd: app('admin'), node_args: '--env-file=.env' },
  ],
}
