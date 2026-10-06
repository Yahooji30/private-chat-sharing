import { z } from 'zod'

const hex = z.string().regex(/^[0-9a-f]{64}$/i)
const bool = z.enum(['true', 'false']).default('false').transform(v => v === 'true')
const schema = z.object({
  APP_NAME: z.string().default('Sync'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PUBLIC_ORIGIN: z.string().url(),
  API_PORT: z.coerce.number().default(4000),
  RT_PORT: z.coerce.number().default(4001),
  DATABASE_URL: z.string(),
  PG_POOL_MAX: z.coerce.number().default(10),
  REDIS_URL: z.string(),
  MASTER_KEY: hex,
  IP_PEPPER: hex,
  COOKIE_SECRET: hex,
  STUN_URLS: z.string().default('stun:stun.l.google.com:19302'),
  TURN_ENABLED: bool,
  TURN_URLS: z.string().default(''),
  TURN_SECRET: hex.optional(),
  CHAT_MSG_CAP: z.coerce.number().default(200),
  CHAT_IDLE_TTL_S: z.coerce.number().default(86400),
  CHAT_RESUME_GRACE_S: z.coerce.number().default(120),
  TEXT_FLUSH_MS: z.coerce.number().default(1000),
  RT_PUBLIC_URL: z.string().default(''),
  MEDIA_DIR: z.string().default('./media'),
  REVALIDATE_SECRET: z.string().default(''),
  NUXT_INTERNAL_URL: z.string().default(''),
  ADMIN_BOOTSTRAP_EMAIL: z.string().default(''),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default(''),
  TRUST_PROXY: z.string().default('true'),
})
export type Env = z.infer<typeof schema>
export const env: Env = schema.parse(process.env)
export const isProd = env.NODE_ENV === 'production'
