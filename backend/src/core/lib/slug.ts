export function slugify(s: string): string {
  const out = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return out || 'post'
}

/** Returns a slug not present in `taken`, adding -2, -3... as needed. */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  let slug = base
  for (let n = 2; await exists(slug); n++) slug = `${base}-${n}`
  return slug
}
