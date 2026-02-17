import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { TRPCRouter } from 'bordly-backend/trpc';
import superjson from 'superjson';

import { TRPCProvider } from '@/trpc';
import { Env } from '@/utils/env';

let BROWSER_QUERY_CLIENT: QueryClient | undefined;

const TRPC_CLIENT = createTRPCClient<TRPCRouter>({
  links: [
    httpBatchStreamLink({
      transformer: superjson,
      url: `${Env.VITE_API_ENDPOINT}/trpc`,
      fetch(url: string, options: object) {
        return fetch(url, { ...options, credentials: 'include' });
      },
    }),
  ],
});

const makeQueryClient = () =>
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
    return makeQueryClient(); // Server: always make a new query client
  } else {
    if (!BROWSER_QUERY_CLIENT) BROWSER_QUERY_CLIENT = makeQueryClient(); // Browser: make a new query client if we don't already have one
    return BROWSER_QUERY_CLIENT;
  }
};

export const getContext = () => {
  const queryClient = getQueryClient();

  const serverHelpers = createTRPCOptionsProxy({ client: TRPC_CLIENT, queryClient: queryClient });
  return { queryClient, trpc: serverHelpers };
};

export const Provider = ({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={TRPC_CLIENT} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
};
