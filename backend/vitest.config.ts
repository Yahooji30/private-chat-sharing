import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'], globalSetup: ['test/global.ts'], fileParallelism: false, testTimeout: 20_000,
    env: {
      NODE_ENV: 'test', PUBLIC_ORIGIN: 'http://localhost:3000',
      DATABASE_URL: 'postgres://sync_app:sync_dev@127.0.0.1:5432/sync_test', REDIS_URL: 'redis://127.0.0.1:6379/1',
      MASTER_KEY: '0'.repeat(64), IP_PEPPER: '1'.repeat(64), COOKIE_SECRET: '2'.repeat(64), CHAT_RESUME_GRACE_S: '1',
    },
  },
})
