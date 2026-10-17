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
  CHAT_RESUME_GRACE_S: z.coerce.number().default(30),
  TEXT_FLUSH_MS: z.coerce.number().default(1000),
  TEXT_MAX_CHARS: z.coerce.number().int().min(1000).max(1_000_000).default(100_000),
  MEDIA_DIR: z.string().default('./media'),
  REVALIDATE_SECRET: z.string().default(''),
  NUXT_INTERNAL_URL: z.string().default(''),
  /** the blog's public address, e.g. https://blog.jodbox.com (used for IndexNow) */
  BLOG_ORIGIN: z.string().default(''),
  /** IndexNow key: 8 to 128 letters, digits or dashes, e.g. from `openssl rand -hex 16`. Empty = IndexNow off. */
  INDEXNOW_KEY: z.union([z.literal(''), z.string().regex(/^[A-Za-z0-9-]{8,128}$/)]).default(''),
  ADMIN_BOOTSTRAP_EMAIL: z.string().default(''),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default(''),
  /** who may tell us the visitor's address: `true` (nginx is the only way in), `false`, a number of proxies, or `loopback` / a list of addresses. See core/lib/proxy.ts */
  TRUST_PROXY: z.string().default('true'),
  /** the network address the API and realtime server listen on. 127.0.0.1 = only nginx on this machine can reach them (recommended); 0.0.0.0 = every network */
  BIND_HOST: z.string().default('0.0.0.0'),
  /** anonymous "public pages" API. Nothing in the apps uses it any more; off unless switched on. */
  PUBLIC_PAGES: bool,
})
export type Env = z.infer<typeof schema>
export const env: Env = schema.parse(process.env)
export const isProd = env.NODE_ENV === 'production'
