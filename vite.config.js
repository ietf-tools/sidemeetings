import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import viteFastifyPlugin from '@fastify/vite/plugin'

// https://vite.dev/config/
export default defineConfig({
  root: import.meta.dirname,
  plugins: [viteFastifyPlugin({ spa: true }), vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend', import.meta.url))
    }
  }
})
