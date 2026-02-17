import { createFileRoute, redirect } from '@tanstack/react-router';

import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/')({
  component: Home,
  loader: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    return { currentUser };
  },
});

function Home() {
  const { currentUser } = Route.useLoaderData();

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
