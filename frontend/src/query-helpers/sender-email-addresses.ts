import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';

export type SenderEmailAddressesData =
  inferRouterOutputs<TRPCRouter>['senderEmailAddress']['getAddressesForBoardMember'];
export type SenderEmailAddress = SenderEmailAddressesData['senderEmailAddresses'][number];
