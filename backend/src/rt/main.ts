import { env } from '../core/config/env'
import { buildRt } from './server'

const rt = await buildRt()
rt.http.listen(env.RT_PORT, '0.0.0.0')
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => void rt.close().then(() => process.exit(0)))
