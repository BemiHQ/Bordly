import { createFileRoute, redirect } from '@tanstack/react-router';
import { ensureNotLoggedIn } from '@/loaders/authentication';
import { API_ENDPOINTS } from '@/utils/urls';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    await ensureNotLoggedIn({ context });
    throw redirect({ href: API_ENDPOINTS.AUTH_GOOGLE });
  },
});
