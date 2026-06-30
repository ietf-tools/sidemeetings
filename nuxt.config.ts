export default defineNuxtConfig({
  compatibilityDate: '2026-06-28',
  srcDir: 'frontend/',
  ssr: false,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      // Same-origin default for the integrated build (Fastify serves this SPA).
      // Dev overrides it via .env to point at the standalone backend on :4000.
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '/api'
    }
  },
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://static.ietf.org', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://static.ietf.org/fonts/inter/import.css' },
        { rel: 'stylesheet', href: 'https://static.ietf.org/fonts/ibm-plex-mono/import.css' }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  devServer: {
    port: 3000
  }
})
