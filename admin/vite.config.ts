import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const api = env.ADMIN_API_URL || 'http://127.0.0.1:4000'
  return {
    plugins: [vue(), tailwindcss()],
    server: { port: Number(env.PORT || 5173), proxy: { '/api': api, '/media': api } },
  }
})
