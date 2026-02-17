import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import superjson from 'superjson';
import { routeTree } from '@/routeTree.gen';
import { createTrpcClient, TRPCProvider } from '@/trpc';
import { isSsr } from '@/utils/ssr';
import '@/utils/error-tracking';

let BROWSER_QUERY_CLIENT: QueryClient | undefined;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1_000, // With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client
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
  const { trpcClient, trpcProxy } = createTrpcClient(queryClient);

  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    context: { trpc: trpcProxy, queryClient },
    defaultPendingComponent: () => null,
    defaultNotFoundComponent: () => <div>404 - Not Found</div>,
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
