// cd blog && pnpm build && pm2 start ecosystem.config.cjs     (reads blog/.env)
module.exports = { apps: [{ name: 'sync-blog', script: '.output/server/index.mjs', cwd: __dirname, node_args: '--env-file=.env' }] }
