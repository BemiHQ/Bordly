import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';

import type { TRPCRouter } from 'bordly-backend/trpc-router';
import superjson from 'superjson';

import { routeTree } from '@/routeTree.gen';
import { TRPCProvider } from '@/trpc';
import { ENV } from '@/utils/env';

let BROWSER_QUERY_CLIENT: QueryClient | undefined;

const fetchSessionCookie = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest();
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const sessionIdMatch = cookieHeader.match(new RegExp(`${ENV.VITE_SESSION_COOKIE_NAME}=([^;]+)`));
  return sessionIdMatch ? `${ENV.VITE_SESSION_COOKIE_NAME}=${sessionIdMatch[1]}` : null;
});

const createTrpcClient = () =>
  createTRPCClient<TRPCRouter>({
    links: [
      httpBatchStreamLink({
        transformer: superjson,
        url: `${ENV.VITE_API_ENDPOINT}/trpc`,
        async fetch(url, options) {
          const cookie = await fetchSessionCookie();
          return fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              ...options?.headers,
              ...(cookie ? { cookie } : {}),
            },
          });
        },
      }),
    ],
  });

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client
      },
      dehydrate: { serializeData: superjson.serialize },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });

const getQueryClient = () => {
  if (typeof window === 'undefined') {
    return createQueryClient(); // Server: always make a new query client
  } else {
    if (!BROWSER_QUERY_CLIENT) BROWSER_QUERY_CLIENT = createQueryClient(); // Browser: make a new query client if we don't already have one
    return BROWSER_QUERY_CLIENT;
  }
};

export const getRouter = () => {
  const queryClient = getQueryClient();
  const trpcClient = createTrpcClient();
  const trpc = createTRPCOptionsProxy({ client: trpcClient, queryClient: queryClient });

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    context: { trpc, queryClient },
    defaultPendingComponent: () => <div className={`p-2 text-2xl`}>Spinning...</div>,
    Wrap: function WrapComponent({ children }) {
      return (
        <QueryClientProvider client={queryClient}>
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            {children}
          </TRPCProvider>
        </QueryClientProvider>
      );
    },
  });

  return router;
};
