import { env } from '../core/config/env'
import { warnIfOpen } from '../core/lib/bind'
import { buildRt } from './server'

const rt = await buildRt()
rt.http.listen(env.RT_PORT, env.BIND_HOST, () => warnIfOpen('Realtime', env.RT_PORT))
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => void rt.close().then(() => process.exit(0)))
