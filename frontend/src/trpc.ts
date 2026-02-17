import { createTRPCContext } from '@trpc/tanstack-react-query';

import type { TRPCRouter } from 'bordly-backend/trpc-router';

export const { TRPCProvider } = createTRPCContext<TRPCRouter>();
