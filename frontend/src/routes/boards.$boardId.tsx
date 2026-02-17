import { createFileRoute, redirect } from '@tanstack/react-router';
import { Navbar } from '@/components/navbar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/boards/$boardId')({
  component: Home,
  loader: async ({ context, params }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }

    const board = await context.queryClient.ensureQueryData(
      context.trpc.board.getBoard.queryOptions({ boardId: extractUuid(params.boardId) }),
    );
    return { currentUser, board };
  },
});

const EmptyState = () => {
  const { currentUser } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      <Empty className="w-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner />
          </EmptyMedia>
          <EmptyTitle>Importing your emails...</EmptyTitle>
          <EmptyDescription>Please wait while we set up your board. This may take a few minutes.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};

function Home() {
  const { currentUser, board } = Route.useLoaderData();

  if (board.boardColumns.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
    </div>
  );
}
