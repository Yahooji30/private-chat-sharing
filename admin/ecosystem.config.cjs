// cd admin && pnpm build && pm2 start ecosystem.config.cjs     (reads admin/.env)
module.exports = { apps: [{ name: 'sync-admin', script: 'server.mjs', cwd: __dirname, node_args: '--env-file=.env' }] }
