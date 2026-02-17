import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    nitro({
      routeRules: {
        '/**': {
          headers: {
            'Content-Security-Policy': [
              "default-src 'none'",
              "script-src 'self' 'unsafe-inline'",
              "img-src 'self' https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src 'none'",
              `connect-src 'self' ${process.env.VITE_API_ENDPOINT}`,
              "manifest-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        },
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
