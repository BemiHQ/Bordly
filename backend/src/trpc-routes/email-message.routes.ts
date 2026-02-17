import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardService } from '@/services/board.service';
import { EmailMessageService } from '@/services/email-message.service';

import { publicProcedure } from '@/trpc-config';

export const EMAIL_MESSAGE_ROUTES = {
  emailMessage: {
    getEmailMessages: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
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
