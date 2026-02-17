import type { QueryClient } from '@tanstack/react-query';

export const cachedQueries = (queryClient: QueryClient) => {
  return queryClient
    .getQueryCache()
    .getAll()
    .map((q) => ({ hash: q.queryHash, status: q.state.status, data: q.state.data }));
};
