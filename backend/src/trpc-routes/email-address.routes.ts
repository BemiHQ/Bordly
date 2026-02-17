import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { EmailAddressService } from '@/services/email-address.service';

import { authAsBoardMember, publicProcedure } from '@/trpc-config';

export const EMAIL_ADDRESS_ROUTES = {
  emailAddress: {
    getEmailAddresses: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board, user } = authAsBoardMember({ ctx, input });
      const emailAddresses = await EmailAddressService.findEmailAddresses(user, board);
      return {
        emailAddresses: emailAddresses.map((emailAddress) => emailAddress.toJson()),
      };
    }),
  } satisfies TRPCRouterRecord,
};
