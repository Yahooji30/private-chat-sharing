import type { Redis } from 'ioredis'

// Writes the next revision of the shared text if nobody else has written since `expectedRev` (compare-and-set), and remembers the
// edit for devices that are a little behind. KEYS: text, dirty, lastOp, history. ARGV: content, expectedRev, spaceId, lastOp value
// ('' = none), history entry (json). Returns the new rev, or -1 when someone else wrote first.
export const TEXT_OP = `
local rev = tonumber(redis.call('HGET', KEYS[1], 'r') or ARGV[2])
if rev ~= tonumber(ARGV[2]) then return -1 end
rev = rev + 1
redis.call('HSET', KEYS[1], 'c', ARGV[1], 'r', rev)
redis.call('EXPIRE', KEYS[1], 3600)
redis.call('SADD', KEYS[2], ARGV[3])
if ARGV[4] ~= '' then redis.call('SET', KEYS[3], ARGV[4], 'EX', 120) end
redis.call('RPUSH', KEYS[4], ARGV[5])
redis.call('LTRIM', KEYS[4], -500, -1)
redis.call('EXPIRE', KEYS[4], 3600)
return rev`

// Refuses an edit for good (so a late copy of it can never be applied) unless it already went through.
// KEYS: lastOp. ARGV: opId, refusal value. Returns the value now stored: 'opId:rev' (rev >= 0) means it was applied.
export const TEXT_FENCE = `
local cur = redis.call('GET', KEYS[1])
if cur and string.sub(cur, 1, string.len(ARGV[1]) + 1) == ARGV[1] .. ':' then return cur end
redis.call('SET', KEYS[1], ARGV[2], 'EX', 120)
return ARGV[2]`

// KEYS: slots, msgs, meta. ARGV: tokenHash, idleTtl, maxMembers, palette
// returns {slot, tailId} or {-1}
export const CHAT_JOIN = `
local slots = redis.call('HGETALL', KEYS[1])
local used = {}
for i = 1, #slots, 2 do used[tonumber(slots[i])] = true end
local slot = -1
for i = 0, tonumber(ARGV[3]) - 1 do if not used[i] then slot = i break end end
if slot < 0 then return {-1} end
redis.call('HSET', KEYS[1], slot, ARGV[1] .. '|live|0')
if redis.call('EXISTS', KEYS[3]) == 0 then redis.call('HSET', KEYS[3], 'palette', ARGV[4]) end
local tail = '0'
local last = redis.call('XREVRANGE', KEYS[2], '+', '-', 'COUNT', 1)
if #last > 0 then tail = last[1][1] end
for i = 1, 3 do redis.call('EXPIRE', KEYS[i], ARGV[2]) end
return {slot, tail}`

// KEYS: slots, msgs, meta. ARGV: slot. frees slot; wipes everything when empty. returns remaining count
export const CHAT_FREE = `
redis.call('HDEL', KEYS[1], ARGV[1])
local n = redis.call('HLEN', KEYS[1])
if n == 0 then redis.call('DEL', KEYS[1], KEYS[2], KEYS[3]) end
return n`

export async function evalLua(r: Redis, src: string, keys: string[], args: (string | number)[]): Promise<unknown> {
  return r.eval(src, keys.length, ...keys, ...args.map(String))
}

// KEYS: slots. ARGV: slot, newValue. sets value only if the slot still exists
export const CHAT_SET_IF_EXISTS = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then redis.call('HSET', KEYS[1], ARGV[1], ARGV[2]) return 1 end
return 0`
