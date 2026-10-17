import { BlockList, isIP } from 'node:net'

/**
 * Which machines may tell us a visitor's address (the X-Forwarded-For header).
 *  - `true` (default, as before): every hop is trusted. Fine when only nginx can reach the app.
 *  - `false`: never trust the header, always use the connection's own address.
 *  - a number: that many proxies in front of the app.
 *  - `loopback` or a comma list of addresses/ranges (e.g. `loopback, 10.0.0.0/8`): the header is believed only when the
 *    connection comes from one of them. Anyone else who reaches the port directly cannot pretend to be another address.
 */
export type Trust = boolean | number | string

export function parseTrust(raw: string): Trust {
  const v = raw.trim().toLowerCase()
  if (v === 'true' || v === '') return true
  if (v === 'false') return false
  if (/^[0-9]+$/.test(v)) return Number(v)
  return raw.trim()
}

const strip = (a: string): string => a.trim().replace(/^::ffff:/i, '')

function listOf(spec: string): BlockList {
  const list = new BlockList()
  for (const t of spec.split(',').map(s => s.trim()).filter(Boolean)) {
    if (t === 'loopback') { list.addSubnet('127.0.0.0', 8, 'ipv4'); list.addAddress('::1', 'ipv6'); continue }
    const [addr = '', bits] = t.split('/')
    const fam = isIP(addr) === 6 ? 'ipv6' : isIP(addr) === 4 ? 'ipv4' : null
    if (!fam) continue
    if (bits === undefined) list.addAddress(addr, fam)
    else list.addSubnet(addr, Number(bits), fam)
  }
  return list
}

const trustedBy = (list: BlockList, addr: string): boolean => {
  const a = strip(addr), fam = isIP(a) === 6 ? 'ipv6' : isIP(a) === 4 ? 'ipv4' : null
  return fam ? list.check(a, fam) : false
}

/**
 * The visitor's address for a realtime connection: the same rule as `trustProxy` of the API. The header's right-most entry is the one
 * our own proxy wrote; anything to its left was sent by the visitor and is never believed.
 */
export function visitorIp(peer: string, forwarded: string | string[] | undefined, trust: Trust): string {
  const header = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded ?? '').split(',').map(strip).filter(Boolean)
  if (trust === false || !header.length) return peer
  if (typeof trust === 'string') {
    const list = listOf(trust)
    if (!trustedBy(list, peer)) return peer
    for (let i = header.length - 1; i >= 0; i--) if (!trustedBy(list, header[i] as string)) return header[i] as string
    return header[0] as string
  }
  const hops = trust === true ? Infinity : trust
  return (hops >= header.length ? header[0] : header[header.length - hops]) as string
}
