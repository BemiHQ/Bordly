import { createFileRoute } from '@tanstack/react-router';
import { API_ENDPOINTS } from '@/utils/urls';

// See frontend/vite.config.ts
const DEFAULT_HEADERS = {
  'Content-Security-Policy': ["default-src 'none'"].join('; '),
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
