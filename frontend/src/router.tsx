import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createTRPCClient, httpBatchStreamLink, loggerLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';

import type { TRPCRouter } from 'bordly-backend/trpc-router';
import superjson from 'superjson';

import { routeTree } from '@/routeTree.gen';
import { TRPCProvider } from '@/trpc';
import { ENV } from '@/utils/env';
import { isSsr } from '@/utils/ssr';

let BROWSER_QUERY_CLIENT: QueryClient | undefined;

const fetchSessionCookie = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest();
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionIdMatch = cookieHeader.match(new RegExp(`${ENV.VITE_SESSION_COOKIE_NAME}=([^;]+)`));
  const sessionCookie = sessionIdMatch ? `${ENV.VITE_SESSION_COOKIE_NAME}=${sessionIdMatch[1]}` : null;

  console.log(
    `[TRPC client] fetch from "${request.url.split(request.headers.get('host') || 'unknown-host')[1]}" ${sessionCookie ? 'with' : 'without'} session cookie`,
  );
  return sessionCookie;
});

const createTrpcClient = () =>
  createTRPCClient<TRPCRouter>({
    links: [
      httpBatchStreamLink({
        transformer: superjson,
        url: `${ENV.VITE_API_ENDPOINT}/trpc`,
        async fetch(url, options) {
          let cookie: string | null = null;
          if (isSsr()) {
            cookie = await fetchSessionCookie(); // SSR: fetch the session cookie from the incoming request
          }
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
      loggerLink({
        enabled: () => true,
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
  if (isSsr()) {
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
    defaultPendingComponent: () => null,
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

  // Rehydrate query data on the client side from SSR
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
