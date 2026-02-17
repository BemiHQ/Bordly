import { createFileRoute } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/h1';
import { ensureNotLoggedIn } from '@/loaders/authentication';
import { API_ENDPOINTS } from '@/utils/urls';

export const Route = createFileRoute('/auth')({
  component: Auth,
  beforeLoad: ensureNotLoggedIn,
});

function Auth() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <img src="/images/logo.png" alt="Bordly Logo" className="w-18 h-18" />

      <H1>Welcome to Bordly</H1>

      <Button size="lg" variant="contrast" asChild>
        <a href={API_ENDPOINTS.AUTH_GOOGLE}>Continue with Google</a>
      </Button>
    </div>
  );
}
