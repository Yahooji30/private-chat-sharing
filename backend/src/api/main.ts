import { env } from '../core/config/env'
import { startCleanup } from '../jobs/cleanup'
import { ensureBootstrapAdmin } from './modules/admin/auth'
import { buildApi } from './server'

const app = await buildApi()
await ensureBootstrapAdmin()
startCleanup(app.redis)
await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => void app.close().then(() => process.exit(0)))
