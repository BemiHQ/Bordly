import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { useTRPC } from '@/trpc';
import { Env } from '@/utils/env';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const trpc = useTRPC();
  const { data: currentUser, isLoading } = useQuery(trpc.user.getCurrentUser.queryOptions());

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome, {currentUser.name}!</h1>
          <p className="text-gray-600 mb-2">{currentUser.email}</p>
          {currentUser.photoUrl && (
            <img src={currentUser.photoUrl} alt={currentUser.name} className="mx-auto rounded-full w-24 h-24 mt-4" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button size="lg" asChild>
        <a href={`${Env.VITE_API_ENDPOINT}/auth/google`}>Continue with Google</a>
      </Button>
    </div>
  );
}
