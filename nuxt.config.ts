import { readFileSync } from 'node:fs'

// App version baked in at build time from package.json (the CI/build step bumps
// it before the docker image is built). Falls back to 0.0.0 in dev.
const appVersion =
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version || '0.0.0'

// This is a client-rendered SPA (ssr: false), so with JavaScript disabled the
// browser gets an empty <div id="__nuxt">. Inject a static explanation at the
// top of <body> instead of a blank page. Styles are inline rather than Tailwind
// utilities so the notice survives independently of the CSS bundle.
const noScriptNotice = `
<div style="max-width:34rem;margin:12vh auto 0;padding:1.75rem;background:#151a22;border:1px solid #272f3b;border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif;color:#e7ebf1;text-align:center">
  <h1 style="margin:0 0 .75rem;font-size:1.125rem;font-weight:600;color:#2dd4bf">JavaScript is required</h1>
  <p style="margin:0 0 .75rem;font-size:.875rem;line-height:1.6;color:#c1c8d3">
    IETF Side Meetings needs JavaScript to show the meeting schedule and to submit
    or manage side meeting requests.
  </p>
  <p style="margin:0;font-size:.875rem;line-height:1.6;color:#9aa4b4">
    Please enable JavaScript in your browser settings, then reload this page.
  </p>
</div>
`

export default defineNuxtConfig({
  compatibilityDate: '2026-06-28',
  srcDir: 'frontend/',
  ssr: false,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      // Same-origin default for the integrated build (Fastify serves this SPA).
      // Dev overrides it via .env to point at the standalone backend on :4000.
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '/api',
      appVersion
    }
  },
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://static.ietf.org', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://static.ietf.org/fonts/inter/import.css' },
        { rel: 'stylesheet', href: 'https://static.ietf.org/fonts/ibm-plex-mono/import.css' },
        // Favicons: IETF Side Meetings icon (theme-independent).
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ],
      noscript: [{ innerHTML: noScriptNotice, tagPosition: 'bodyOpen' }]
    }
  },
  css: ['~/assets/css/main.css'],
  devServer: {
    port: 3000
  }
})
