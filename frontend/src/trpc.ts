import type { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchStreamLink, loggerLink } from '@trpc/client';
import { createTRPCContext, createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import superjson from 'superjson';
import { fetchSessionCookie } from '@/loaders/authentication';
import { ENV } from '@/utils/env';
import { isSsr } from '@/utils/ssr';
import { API_ENDPOINTS } from '@/utils/urls';

export const { TRPCProvider } = createTRPCContext<TRPCRouter>();

export const createTrpcClient = (queryClient: QueryClient) => {
  const trpcClient = createTRPCClient<TRPCRouter>({
    links: [
      httpBatchStreamLink({
        transformer: superjson,
        url: isSsr() && ENV.SSR_API_ENDPOINT ? API_ENDPOINTS.TRPC_SSR : API_ENDPOINTS.TRPC,
        async fetch(url, options) {
          let cookie: string | null = null;
          let timeZone: string | null = null;
          if (isSsr()) {
            cookie = await fetchSessionCookie(); // SSR: fetch the session cookie from the incoming request
          } else {
            timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          }

          return fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              ...options?.headers,
              ...(cookie ? { cookie } : {}),
              ...(timeZone ? { 'x-timezone': timeZone } : {}),
            },
          });
        },
      }),
      loggerLink({
        enabled: () => true,
      }),
    ],
  });

  const trpcProxy = createTRPCOptionsProxy({ client: trpcClient, queryClient });

  return { trpcClient, trpcProxy };
};

export type TrpcProxy = ReturnType<typeof createTrpcClient>['trpcProxy'];
