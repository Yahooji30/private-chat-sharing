import { env } from '../core/config/env'
import { warnIfOpen } from '../core/lib/bind'
import { migrate } from '../core/db/migrate'
import { startCleanup } from '../jobs/cleanup'
import { ensureBootstrapAdmin } from './modules/admin/auth'
import { buildApi } from './server'

await migrate() // new database changes apply on their own, so a pulled update never leaves the API on an old schema
const app = await buildApi()
await ensureBootstrapAdmin()
startCleanup(app.redis)
await app.listen({ port: env.API_PORT, host: env.BIND_HOST })
warnIfOpen('API', env.API_PORT)
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => void app.close().then(() => process.exit(0)))
