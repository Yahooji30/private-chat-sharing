import { Redis } from 'ioredis'
import { env } from '../config/env'

export const newRedis = (): Redis => new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false })
