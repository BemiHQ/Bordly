import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';

export type EmailAddressesData = inferRouterOutputs<TRPCRouter>['senderEmailAddress']['getAddressesForBoardMember'];
export type EmailAddress = EmailAddressesData['senderEmailAddresses'][number];
