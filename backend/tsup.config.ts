import { defineConfig } from 'tsup'
export default defineConfig({
  entry: { api: 'src/api/server.ts', rt: 'src/rt/server.ts' },
  format: ['esm'], target: 'node22', clean: true, noExternal: ['@sync/shared'],
  loader: { '.lua': 'text' },
})
