import type { Config } from 'tailwindcss'

export default {
  content: [
    './backend/pages/**/*.{vue,ts}',
    './backend/layouts/**/*.{vue,ts}',
    './backend/components/**/*.{vue,ts}',
    './backend/composables/**/*.{vue,ts}',
    './backend/stores/**/*.{vue,ts}',
    './backend/app.vue'
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0d1016',
        surface: '#151a22',
        s2: '#1a2029',
        s3: '#222a35',
        border: '#272f3b',
        'border-strong': '#36404e',
        text: '#e7ebf1',
        'text-dim': '#9aa4b4',
        'text-faint': '#6b7585',
        accent: '#2dd4bf',
        'accent-text': '#04241f',
        'accent-weak': '#13312e',
        ok: '#34d399',
        warn: '#e3a93b',
        bad: '#f0716a',
        muted: '#7a8493',
        'sidebar-bg': '#0a0d12',
        'sidebar-text': '#aab4c4',
        'sidebar-text-dim': '#697383',
        'sidebar-active-bg': '#13312e',
        'sidebar-active-text': '#5eead4',
        'sidebar-border': '#1a2029'
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.35)',
        'room-selected': 'inset 0 0 0 1px rgba(45,212,191,.5), inset 0 0 26px rgba(45,212,191,.22)'
      },
      borderRadius: {
        '2xl': '16px'
      }
    }
  },
  plugins: []
} satisfies Config
