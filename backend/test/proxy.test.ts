import { describe, expect, it } from 'vitest'
import { parseTrust, visitorIp } from '../src/core/lib/proxy'

describe('who may tell us the visitor address', () => {
  it('reads the setting', () => {
    expect([parseTrust('true'), parseTrust(''), parseTrust('false'), parseTrust('2'), parseTrust('loopback'), parseTrust('10.0.0.0/8, loopback')]).toEqual([true, true, false, 2, 'loopback', '10.0.0.0/8, loopback'])
  })
  it('default (true): the entry our own proxy wrote counts, anything the visitor added in front of it does not', () => {
    expect(visitorIp('127.0.0.1', '9.9.9.9', true)).toBe('9.9.9.9') // nginx overwrote the header: one entry, as before
    expect(visitorIp('127.0.0.1', '1.2.3.4, 9.9.9.9', 1)).toBe('9.9.9.9') // nginx appended to what the visitor sent
    expect(visitorIp('127.0.0.1', undefined, true)).toBe('127.0.0.1')
    expect(visitorIp('::ffff:127.0.0.1', '::ffff:9.9.9.9', true)).toBe('9.9.9.9')
  })
  it('false: always the connection itself', () => { expect(visitorIp('5.5.5.5', '9.9.9.9', false)).toBe('5.5.5.5') })
  it('loopback: the header is believed only from this machine, so reaching the port directly cannot fake an address', () => {
    expect(visitorIp('127.0.0.1', '9.9.9.9', 'loopback')).toBe('9.9.9.9')
    expect(visitorIp('::1', '9.9.9.9', 'loopback')).toBe('9.9.9.9')
    expect(visitorIp('203.0.113.7', '9.9.9.9', 'loopback')).toBe('203.0.113.7') // an outsider hitting the port directly
    expect(visitorIp('127.0.0.1', '1.2.3.4, 9.9.9.9', 'loopback')).toBe('9.9.9.9')
  })
  it('a list of ranges', () => {
    expect(visitorIp('10.1.2.3', '9.9.9.9', '10.0.0.0/8')).toBe('9.9.9.9')
    expect(visitorIp('11.1.2.3', '9.9.9.9', '10.0.0.0/8')).toBe('11.1.2.3')
    expect(visitorIp('10.1.2.3', '9.9.9.9, 10.5.5.5', '10.0.0.0/8')).toBe('9.9.9.9') // skips the trusted proxy hops on the right
  })
})
