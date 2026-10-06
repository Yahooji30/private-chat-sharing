import { Emitter } from '@socket.io/redis-emitter'
import type { Redis } from 'ioredis'

export const spaceRoom = (id: string) => `space:${id}`
export const ipRoom = (hash: string) => `ip:${hash}`
export const deviceRoom = (id: string) => `device:${id}`
export const spaceEmitter = (redis: Redis) => new Emitter(redis).of('/space')
