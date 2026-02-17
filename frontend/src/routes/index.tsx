import { createFileRoute } from '@tanstack/react-router';

import { ensureNotLoggedIn } from '@/loaders/authentication';

export const Route = createFileRoute('/')({
  beforeLoad: ensureNotLoggedIn,
});
