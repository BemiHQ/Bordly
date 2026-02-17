import { createFileRoute, redirect } from '@tanstack/react-router';

import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }
    throw redirect({ to: ROUTES.BOARD.replace('$boardId', currentUser.boards[0].friendlyId) });
  },
});
