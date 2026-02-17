import type { QueryClient } from '@tanstack/react-query';
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { createContext, useContext } from 'react';

export interface RouteContext {
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<TRPCRouter>;
}

const RouteContextContext = createContext<RouteContext | null>(null);

export const useRouteContext = () => {
  const ctx = useContext(RouteContextContext);
  if (!ctx) throw new Error('useRouteContext must be used within RouteProvider');
  return ctx;
};

export const RouteProvider = RouteContextContext.Provider;
