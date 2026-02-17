import { createTRPCContext } from '@trpc/tanstack-react-query';

import type { TRPCRouter } from 'bordly-backend/trpc';

export const { TRPCProvider, useTRPC } = createTRPCContext<TRPCRouter>();
