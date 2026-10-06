import type { ErrCode } from '@sync/shared'

export class AppError extends Error {
  constructor(public code: ErrCode, message: string, public status = 400) { super(message) }
}
