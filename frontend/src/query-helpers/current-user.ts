import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';

export type CurrentUserData = inferRouterOutputs<TRPCRouter>['user']['getCurrentUser'];
export type CurrentUser = NonNullable<CurrentUserData['currentUser']>;
