import { defineConfig } from 'tsup'
export default defineConfig({
  entry: { api: 'src/api/main.ts', rt: 'src/rt/main.ts' },
  format: ['esm'], target: 'node22', clean: true, noExternal: ['@sync/shared'],
  loader: { '.lua': 'text' },
  // the bundled API applies database migrations at start, so the .sql files travel with it
  onSuccess: `node -e "require('fs').cpSync('src/core/db/migrations','dist/migrations',{recursive:true})"`,
})
