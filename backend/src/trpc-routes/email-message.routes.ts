import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { EmailMessageService } from '@/services/email-message.service';

import { authAsBoardMember, publicProcedure } from '@/trpc-config';

export const EMAIL_MESSAGE_ROUTES = {
  emailMessage: {
    getEmailMessages: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .query(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const { boardCard, emailMessagesAsc } = await EmailMessageService.findEmailMessages(board, {
          boardCardId: input.boardCardId,
          populate: ['domain', 'attachments'],
        });
        return {
          boardCard: boardCard.toJson(),
          boardColumn: boardCard.boardColumn.toJson(),
          emailMessagesAsc: emailMessagesAsc.map((msg) => msg.toJson()),
        };
      }),
  } satisfies TRPCRouterRecord,
};
