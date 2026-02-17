import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/internal/health')({
  server: {
    handlers: {
      GET: () => Response.json({ status: 'ok' }, { status: 200 }),
    },
  },
});
