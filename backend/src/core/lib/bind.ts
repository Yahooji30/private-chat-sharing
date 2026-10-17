import { env, isProd } from '../config/env'

/** In production, say so loudly when the server can be reached from the internet AND believes the X-Forwarded-For header: anyone could then pretend to be any address. */
export function warnIfOpen(what: string, port: number): void {
  if (!isProd) return
  const open = env.BIND_HOST === '0.0.0.0' || env.BIND_HOST === '::'
  if (open && env.TRUST_PROXY.trim().toLowerCase() === 'true') {
    console.warn(`[security] ${what} port ${port} listens on every network and trusts X-Forwarded-For. Close the port in the firewall, or set BIND_HOST=127.0.0.1 and TRUST_PROXY=loopback in backend/.env.`)
  }
}
