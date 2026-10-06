export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message) }
}

const csrf = (): string => document.cookie.split('; ').find(c => c.startsWith('csrf_adm='))?.split('=')[1] ?? ''
let onUnauthorized: () => void = () => undefined
export const setUnauthorizedHandler = (fn: () => void): void => { onUnauthorized = fn }

export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const method = opts.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (method !== 'GET') headers['x-csrf'] = csrf()
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  let res: Response
  try { res = await fetch(`/api${path}`, { method, headers, credentials: 'include', body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)) }) }
  catch { throw new ApiError('NETWORK', 'Network error. Check your connection.', 0) }
  const data = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/admin/auth/login') && !path.startsWith('/admin/auth/totp')) onUnauthorized()
    throw new ApiError(data.error?.code ?? 'ERROR', data.error?.message ?? 'Request failed', res.status)
  }
  return data as T
}

/** Upload with progress (fetch has no upload progress events). */
export function upload<T>(path: string, file: File, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open('POST', `/api${path}`)
    x.withCredentials = true
    x.setRequestHeader('x-csrf', csrf())
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    x.onload = () => {
      const body = JSON.parse(x.responseText || '{}') as { error?: { code: string; message: string } }
      if (x.status >= 200 && x.status < 300) resolve(body as T)
      else reject(new ApiError(body.error?.code ?? 'ERROR', body.error?.message ?? 'Upload failed', x.status))
    }
    x.onerror = () => reject(new ApiError('NETWORK', 'Network error during upload', 0))
    const fd = new FormData(); fd.append('file', file)
    x.send(fd)
  })
}
