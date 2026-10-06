// cd frontend && pnpm build && pm2 start ecosystem.config.cjs     (reads frontend/.env)
module.exports = { apps: [{ name: 'sync-web', script: '.output/server/index.mjs', cwd: __dirname, node_args: '--env-file=.env' }] }
