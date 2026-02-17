import { TRPCError, type TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { SenderEmailAddressService } from '@/services/sender-email-address.service';

import { authAsBoardMember, publicProcedure } from '@/trpc-config';

export const SENDER_EMAIL_ADDRESS_ROUTES = {
  senderEmailAddress: {
    getAddresses: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board, user } = authAsBoardMember({ ctx, input });
      const senderEmailAddresses = await SenderEmailAddressService.findAddressesByBoard(user, board);
      return {
        senderEmailAddresses: senderEmailAddresses.map((emailAddress) => emailAddress.toJson()),
      };
    }),
    getUserAddresses: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const senderEmailAddresses = await SenderEmailAddressService.findAddressesByGmailAccount(ctx.user.gmailAccount);
      return {
        senderEmailAddresses: senderEmailAddresses.map((emailAddress) => emailAddress.toJson()),
      };
    }),
  } satisfies TRPCRouterRecord,
};
