import type { FetchQueryOptions, QueryClient, QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';

const DELAY_MS = 750;

// Prefetch on the client-side
export const usePrefetchQuery = <
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient: QueryClient,
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) => {
  useEffect(() => {
    const timeoutId = setTimeout(() => queryClient.prefetchQuery(options), DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [queryClient, options]);
};
