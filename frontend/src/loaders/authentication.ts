import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import type { RouteContext } from '@/hooks/use-route-context';
import { isSsr } from '@/utils/ssr';
import { ROUTES } from '@/utils/urls';

const SESSION_COOKIE_NAME = 'sId';

export const fetchSessionCookie = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest();
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionIdMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return sessionIdMatch ? `${SESSION_COOKIE_NAME}=${sessionIdMatch[1]}` : null;
});

export const ensureNotLoggedIn = async ({ context }: { context: RouteContext }) => {
  if (isSsr()) {
    const sessionCookie = await fetchSessionCookie();
    if (!sessionCookie) return;
  }

  const { currentUser, boards } = await context.queryClient.ensureQueryData(
    context.trpc.user.getCurrentUser.queryOptions(),
  );
  if (!currentUser) return;

  if (boards.length === 0) {
    throw redirect({ to: ROUTES.WELCOME });
  } else {
    throw redirect({ to: ROUTES.BOARD.replace('$boardId', boards[0].friendlyId) });
  }
};

export const ensureLoggedIn =
  (currentRoute: string) =>
  async ({ context }: { context: RouteContext }) => {
    const { currentUser, boards } = await context.queryClient.ensureQueryData(
      context.trpc.user.getCurrentUser.queryOptions(),
    );
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }

    if (boards.length === 0 && currentRoute !== ROUTES.WELCOME) {
      throw redirect({ to: ROUTES.WELCOME });
    }

    return { currentUser };
  };
