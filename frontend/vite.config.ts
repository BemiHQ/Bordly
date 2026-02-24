import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  esbuild: {
    legalComments: 'none',
  },
  plugins: [
    nitro({
      routeRules: {
        '/**': {
          headers: { // Sync with frontend/src/routes/auth.tsx
            'Content-Security-Policy': [
              "default-src 'none'",
              "img-src 'self' https: data:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `connect-src 'self' ${process.env.VITE_API_ENDPOINT}`,
              "script-src 'self' 'unsafe-inline'",
              "frame-src 'self'",
              "frame-ancestors 'self'",
              "manifest-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
            'X-Frame-Options': 'SAMEORIGIN',
            'Cache-Control': 'no-cache, no-store, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        },
        '/assets/**':        { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        '/images/**':        { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        '/screenshots/**':   { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        '/domain-icons/**':  { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        '/favicon.ico':      { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
        '/site.webmanifest': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
