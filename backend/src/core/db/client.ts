import postgres from 'postgres'
import { env } from '../config/env'

export const sql = postgres(env.DATABASE_URL, { max: env.PG_POOL_MAX, onnotice: () => {} })
