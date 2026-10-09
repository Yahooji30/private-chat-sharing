import { z } from 'zod'

export const LIMITS = {
  textChars: 100_000,
  blockSize: 1024 * 1024,
  maxFiles: 100,
  fileNameChars: 255,
  chatMaxMembers: 4,
  chatMsgChars: 2000,
  chatCtBytes: 8192,
  pageBodyChars: 50_000,
  deviceNameChars: 40,
} as const

export const ERR = {
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  TEXT_TOO_LARGE: 'TEXT_TOO_LARGE',
  LINK_INVALID: 'LINK_INVALID',
  LINK_LIMIT: 'LINK_LIMIT',
  IP_INVALID: 'IP_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  SLUG_TAKEN: 'SLUG_TAKEN',
  ROOM_EXISTS: 'ROOM_EXISTS',
  ROOM_BAD_AUTH: 'ROOM_BAD_AUTH',
  ROOM_LOCKED: 'ROOM_LOCKED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CSRF: 'CSRF',
  CONFLICT: 'CONFLICT',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  INTERNAL: 'INTERNAL',
} as const
export type ErrCode = (typeof ERR)[keyof typeof ERR]
export interface ApiError { error: { code: ErrCode; message: string } }

export const EV = {
  textUpdate: 'text:update',
  textChanged: 'text:changed',
  presence: 'presence:list',
  filesAdd: 'files:add',
  filesAdded: 'files:added',
  filesReady: 'files:ready',
  filesRemove: 'files:remove',
  filesRemoved: 'files:removed',
  filesClear: 'files:clear',
  filesCleared: 'files:cleared',
  filesHolder: 'files:holder',
  filesHolders: 'files:holders',
  rtcSignal: 'rtc:signal',
  settingsChanged: 'settings:changed',
  linkJoined: 'link:joined',
  linkRevoked: 'link:revoked',
  chatMembers: 'chat:members',
  chatMsg: 'chat:msg',
  chatTyping: 'chat:typing',
  chatSystem: 'chat:system',
  chatFull: 'chat:full',
  chatClosed: 'chat:closed',
  chatLeave: 'chat:leave',
} as const

const b64 = z.string().regex(/^[A-Za-z0-9+/=_-]+$/)

export const settingsSchema = z.object({
  fontFamily: z.enum(['sans', 'serif', 'mono']).default('sans'),
  fontSize: z.number().int().min(12).max(28).default(16),
  urlsPanel: z.boolean().default(true),
  urlsAutoExpand: z.boolean().default(true),
  urlsNewTab: z.boolean().default(true),
  adsDisabled: z.boolean().default(false),
})
export type Settings = z.infer<typeof settingsSchema>
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({})

export const textUpdateSchema = z.object({
  content: z.string().max(LIMITS.textChars),
  baseRev: z.number().int().min(0),
})
export const deviceRenameSchema = z.object({ name: z.string().trim().min(1).max(LIMITS.deviceNameChars) })

export const fileMetaSchema = z.object({
  fileId: z.string().regex(/^[A-Za-z0-9_-]{8,32}$/),
  name: z.string().min(1).max(LIMITS.fileNameChars),
  mime: z.string().max(100),
  size: z.number().int().min(0).max(4 * 1024 ** 3),
  blockSize: z.number().int().min(64 * 1024).max(16 * 1024 * 1024).default(LIMITS.blockSize),
  thumb: z.string().max(40_000).optional(),
})
export type FileMeta = z.infer<typeof fileMetaSchema>
export interface FileEntry extends FileMeta {
  rootHash: string | null
  addedBy: string
  addedAt: number
  holders: string[]
}
export const fileReadySchema = z.object({ fileId: fileMetaSchema.shape.fileId, rootHash: z.string().regex(/^[0-9a-f]{64}$/) })
export const fileIdSchema = z.object({ fileId: fileMetaSchema.shape.fileId })
export const rtcSignalSchema = z.object({ to: z.string().min(8).max(80), data: z.unknown() })

export const linkRedeemSchema = z.object({ code: z.string().transform(s => s.replace(/[-\s]/g, '').toUpperCase()).pipe(z.string().regex(/^[0-9A-HJKMNP-TV-Z]{8}$/)) })
export const linkIpSchema = z.object({ ip: z.string().min(2).max(45) })

export const pageCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().min(1).max(LIMITS.pageBodyChars),
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/).optional(),
  indexable: z.boolean().default(false),
})
export const pageUpdateSchema = pageCreateSchema.partial().omit({ slug: true })
export const reportSchema = z.object({ reason: z.string().trim().min(3).max(300) })

export const roomCodeSchema = z.string().regex(/^[A-Za-z0-9]{4,16}$/)
export const roomCreateSchema = z.object({ code: roomCodeSchema.optional(), authKey: b64.min(20).max(100), kdfSalt: b64.min(16).max(40) })
export const ticketSchema = z.object({ authKey: b64.min(20).max(100) })
export const roomManageSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), manageToken: z.string().min(16).max(100) }),
  z.object({ action: z.literal('repassword'), manageToken: z.string().min(16).max(100), authKey: b64.min(20).max(100), kdfSalt: b64.min(16).max(40) }),
])
export const chatMsgSchema = z.object({ iv: b64.max(32), ct: b64.max(LIMITS.chatCtBytes * 2) })
export const chatResumeSchema = z.object({ code: roomCodeSchema, token: z.string().min(16).max(100), lastId: z.string().max(40) })

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const articleStatus = z.enum(['draft', 'scheduled', 'published', 'archived'])
export type ArticleStatus = z.infer<typeof articleStatus>
const optId = z.string().max(40).nullable().optional()
export const articleInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/).optional(),
  excerpt: z.string().max(500).default(''),
  body: z.string().max(200_000).default(''),
  coverMediaId: optId, ogMediaId: optId, categoryId: optId,
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  seoTitle: z.string().max(120).default(''),
  seoDescription: z.string().max(300).default(''),
  status: articleStatus.default('draft'),
  publishAt: z.string().datetime().nullable().optional(),
})
export type ArticleInput = z.infer<typeof articleInputSchema>
export const nameSlugSchema = z.object({ name: z.string().trim().min(1).max(60), slug: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(), description: z.string().max(300).optional() })
export const adminLoginSchema = z.object({ email: z.string().email().max(120), password: z.string().min(1).max(200) })
export const adminTotpSchema = z.object({ pendingToken: z.string().min(10).max(100), code: z.string().regex(/^\d{6}$/) })
export const passwordSchema = z.string().min(12).max(200)
export const adminCreateSchema = z.object({ email: z.string().email().max(120), name: z.string().trim().min(1).max(60), password: passwordSchema, role: z.enum(['owner', 'admin']).default('admin') })
export const SITE_KEYS = ['site_name', 'tagline', 'default_og_media_id', 'social_x', 'social_facebook', 'social_instagram', 'social_youtube', 'analytics_id', 'chat_share_message', 'privacy_md', 'terms_md'] as const
export const siteSettingsSchema = z.partialRecord(z.enum(SITE_KEYS), z.string().max(60_000))

// ---- FAQ, feedback, per-page SEO, chat invite message ----
export const faqInputSchema = z.object({
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(5000),
  category: z.string().trim().max(60).default(''),
  published: z.boolean().default(true),
})
export type FaqInput = z.infer<typeof faqInputSchema>
export const faqReorderSchema = z.object({ ids: z.array(z.string().max(40)).min(1).max(500) })

export const FEEDBACK_STATUS = ['new', 'read', 'archived'] as const
export const feedbackInputSchema = z.object({
  name: z.string().trim().max(60).default(''),
  email: z.union([z.literal(''), z.string().trim().email().max(120)]).default(''),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(5).max(2000),
  /** honeypot: real visitors never fill this in */
  website: z.string().max(200).optional(),
})
export const feedbackUpdateSchema = z.object({ status: z.enum(FEEDBACK_STATUS).optional(), public: z.boolean().optional() })

/** Every page whose search-engine tags the admin can edit. `site` = which web app serves it. */
export const SEO_PAGES = [
  { key: 'home', label: 'App: Home', site: 'app', path: '/' },
  { key: 'chat', label: 'App: Secure chat', site: 'app', path: '/chat' },
  { key: 'blog', label: 'Site: Blog', site: 'site', path: '/' },
  { key: 'features', label: 'Site: Features', site: 'site', path: '/features' },
  { key: 'faq', label: 'Site: FAQ', site: 'site', path: '/faq' },
  { key: 'feedback', label: 'Site: Feedback', site: 'site', path: '/feedback' },
  { key: 'privacy', label: 'Site: Privacy', site: 'site', path: '/privacy' },
  { key: 'terms', label: 'Site: Terms', site: 'site', path: '/terms' },
] as const
export type SeoKey = (typeof SEO_PAGES)[number]['key']
export const SEO_KEYS = SEO_PAGES.map(p => p.key) as [SeoKey, ...SeoKey[]]
export const seoInputSchema = z.object({
  title: z.string().trim().max(120).default(''),
  description: z.string().trim().max(320).default(''),
  keywords: z.string().trim().max(300).default(''),
  ogTitle: z.string().trim().max(120).default(''),
  ogDescription: z.string().trim().max(320).default(''),
  ogMediaId: z.string().max(40).nullable().optional(),
  canonical: z.union([z.literal(''), z.string().trim().max(300).regex(/^https?:\/\/\S+$/, 'Must start with http:// or https://')]).default(''),
  noindex: z.boolean().default(false),
})
export type SeoInput = z.infer<typeof seoInputSchema>
/** What the public `GET /api/seo` returns per page (only pages the admin has filled in). */
export interface SeoEntry { title: string; description: string; keywords: string; ogTitle: string; ogDescription: string; ogImage: string; canonical: string; noindex: boolean }

export const DEFAULT_CHAT_SHARE_MESSAGE = 'I have sent you a secret message. Please click on this link, use the password ** and read the message.'
/** Builds the text that is sent through WhatsApp and friends: the admin's template plus the room link on its own line. */
export function chatShareText(template: string | undefined, link: string): string {
  const t = (template ?? '').trim() || DEFAULT_CHAT_SHARE_MESSAGE
  return t.includes('{link}') ? t.replaceAll('{link}', link) : `${t}\n\n${link}`
}
