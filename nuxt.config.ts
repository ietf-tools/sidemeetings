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
        { rel: 'stylesheet', href: 'https://static.ietf.org/fonts/ibm-plex-mono/import.css' },
        // Favicons: IETF square logo on a white background (theme-independent).
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  devServer: {
    port: 3000
  }
})
