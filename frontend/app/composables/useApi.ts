import type { ApiError } from '@sync/shared'

export class ApiFailure extends Error {
  constructor(public code: string, message: string, public status: number) { super(message) }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  try {
    return await $fetch<T>(`/api${path}`, { method: (opts.method ?? 'GET') as 'GET', body: opts.body as Record<string, unknown>, headers: opts.headers, credentials: 'include' })
  } catch (e) {
    const r = (e as { data?: ApiError; status?: number; statusCode?: number })
    throw new ApiFailure(r.data?.error?.code ?? 'NETWORK', r.data?.error?.message ?? 'Network error. Check your connection.', r.status ?? r.statusCode ?? 0)
  }
}
