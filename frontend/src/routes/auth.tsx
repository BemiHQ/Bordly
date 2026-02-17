import { createFileRoute, redirect } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
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
    <div className="flex min-h-screen items-center justify-center">
      <Button size="lg" asChild>
        <a href={`${ENV.VITE_API_ENDPOINT}/auth/google`}>Continue with Google</a>
      </Button>
    </div>
  );
}
