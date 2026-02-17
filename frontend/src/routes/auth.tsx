import { createFileRoute, redirect } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/h1';
import { ENV } from '@/utils/env';
import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/auth')({
  component: Auth,
  beforeLoad: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (currentUser) {
      throw redirect({ to: ROUTES.HOME });
    }
  },
});

function Auth() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <img src="/images/logo.png" alt="Bordly Logo" className="w-18 h-18" />

      <H1>Welcome to Bordly</H1>

      <Button size="lg" variant="contrast" asChild>
        <a href={`${ENV.VITE_API_ENDPOINT}/auth/google`}>Continue with Google</a>
      </Button>
    </div>
  );
}
