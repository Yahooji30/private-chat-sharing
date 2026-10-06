import { defineConfig } from 'tsup'
export default defineConfig({
  entry: { api: 'src/api/main.ts', rt: 'src/rt/main.ts' },
  format: ['esm'], target: 'node22', clean: true, noExternal: ['@sync/shared'],
  loader: { '.lua': 'text' },
})
