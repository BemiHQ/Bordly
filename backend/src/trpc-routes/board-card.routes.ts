import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { State } from '@/entities/board-card';
import { BoardCardService } from '@/services/board-card.service';

import { authAsBoardMember, publicProcedure } from '@/trpc-config';

export const BOARD_CARD_ROUTES = {
  boardCard: {
    getBoardCards: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board } = authAsBoardMember({ ctx, input });
      const { boardCardsDesc } = await BoardCardService.findCardsByBoard(board, {
        populate: ['domain', 'emailDraft.fileAttachments'],
      });
      return { boardCardsDesc: boardCardsDesc.map((card) => card.toJson()) };
    }),
    markAsRead: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.markAsRead(board, {
          boardCardId: input.boardCardId,
          populate: ['domain', 'emailDraft.fileAttachments'],
        });
        return { boardCard: boardCard.toJson() };
      }),
    markAsUnread: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.markAsUnread(board, {
          boardCardId: input.boardCardId,
          populate: ['domain', 'emailDraft.fileAttachments'],
        });
        return { boardCard: boardCard.toJson() };
      }),
    setBoardColumn: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), boardColumnId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.setBoardColumn(board, {
          boardCardId: input.boardCardId,
          boardColumnId: input.boardColumnId,
          populate: ['domain', 'emailDraft.fileAttachments'],
        });
        return { boardCard: boardCard.toJson() };
      }),
    setState: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), state: z.enum(Object.values(State)) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.setState(board, {
          boardCardId: input.boardCardId,
          state: input.state,
          populate: ['domain', 'emailDraft.fileAttachments'],
        });
        return { boardCard: boardCard.toJson() };
      }),
  } satisfies TRPCRouterRecord,
};
