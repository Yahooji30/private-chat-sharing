// cd backend && pnpm build && pm2 start ecosystem.config.cjs     (reads backend/.env)
module.exports = {
  apps: [
    { name: 'sync-api', script: 'dist/api.js', cwd: __dirname, node_args: '--env-file=.env' },
    { name: 'sync-rt', script: 'dist/rt.js', cwd: __dirname, node_args: '--env-file=.env' },
  ],
}
