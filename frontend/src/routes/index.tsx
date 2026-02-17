import { createFileRoute, redirect } from '@tanstack/react-router';

import { Navbar } from '@/components/navbar';
import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/')({
  component: Home,
  loader: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }
    return { currentUser };
  },
});

function Home() {
  const { currentUser } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome, {currentUser.name}!</h1>
          <p className="text-gray-600 mb-2">
            {currentUser.boards.map((b) => b.name).join(', ') || 'You have no boards yet.'}
          </p>
        </div>
      </div>
    </div>
  );
}
