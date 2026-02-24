import { createFileRoute } from '@tanstack/react-router';
import { ENV } from '@/utils/env';
import { API_ENDPOINTS } from '@/utils/urls';

// See frontend/vite.config.ts
const DEFAULT_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'none'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${ENV.SSR_API_ENDPOINT}`,
    "script-src 'self' 'unsafe-inline'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'SAMEORIGIN',
  'Cache-Control': 'no-cache, no-store, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
};

export const Route = createFileRoute('/auth')({
  server: {
    handlers: {
      GET: () => {
        return new Response(null, {
          status: 302,
          headers: { ...DEFAULT_HEADERS, Location: API_ENDPOINTS.AUTH_GOOGLE },
        });
      },
    },
  },
});
