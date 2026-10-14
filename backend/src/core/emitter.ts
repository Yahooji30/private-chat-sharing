import { Emitter } from '@socket.io/redis-emitter'
import type { Redis } from 'ioredis'

export const spaceRoom = (id: string) => `space:${id}`
/** devices running the current app, which are sent each edit (older ones are sent the whole text) */
export const opRoom = (id: string) => `space:${id}:ops`
export const ipRoom = (hash: string) => `ip:${hash}`
export const deviceRoom = (id: string) => `device:${id}`
export const spaceEmitter = (redis: Redis) => new Emitter(redis).of('/space')
