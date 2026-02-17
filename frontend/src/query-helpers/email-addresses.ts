import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';

export type EmailAddressesData = inferRouterOutputs<TRPCRouter>['emailAddress']['getEmailAddresses'];
export type EmailAddress = EmailAddressesData['emailAddresses'][number];
