import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardCardService } from '@/services/board-card.service';
import { EmailMessageService } from '@/services/email-message.service';
import { authAsBoardMember, publicProcedure } from '@/trpc-config';
import { POPULATE as BOARD_CARD_POPULATE, toJson as boardCardToJson } from '@/trpc-routes/board-card.routes';

export const EMAIL_MESSAGE_ROUTES = {
  emailMessage: {
    getEmailMessages: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .query(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: [...BOARD_CARD_POPULATE, 'boardColumn'],
        });
        const emailMessagesAsc = await EmailMessageService.findEmailMessageByBoardCard(boardCard, {
          populate: ['domain', 'gmailAttachments'],
          orderBy: { externalCreatedAt: 'ASC' },
        });
        return {
          boardCard: boardCardToJson(boardCard, ctx),
          boardColumn: boardCard.loadedBoardColumn.toJson(),
          emailMessagesAsc: emailMessagesAsc.map((msg) => msg.toJson()),
        };
      }),
  } satisfies TRPCRouterRecord,
};
