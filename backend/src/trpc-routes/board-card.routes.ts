import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import type { BoardCard } from '@/entities/board-card';
import { State } from '@/entities/board-card';
import { BoardCardService } from '@/services/board-card.service';
import { CommentService } from '@/services/comment.service';
import { EmailMessageService } from '@/services/email-message.service';
import { authAsBoardMember, type Context, publicProcedure } from '@/trpc-config';
import { POPULATE as COMMENT_POPULATE } from '@/trpc-routes/comment.routes';

export const POPULATE = ['domain', 'boardCardReadPositions', 'emailDraft.fileAttachments'] as const;

export const toJson = (boardCard: BoardCard, ctx: Context) => {
  const user = ctx.user!;
  const boardCardReadPosition = boardCard.boardCardReadPositions.find((pos) => pos.user.id === user.id)!;

  return {
    ...boardCard.toJson(),
    unread: boardCardReadPosition.lastReadAt < boardCard.lastEventAt,
  };
};

export const BOARD_CARD_ROUTES = {
  boardCard: {
    getBoardCards: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board } = authAsBoardMember({ ctx, input });
      const { boardCardsDesc } = await BoardCardService.findInboxCardsByBoardId(board.id, { populate: POPULATE });
      return { boardCardsDesc: boardCardsDesc.map((card) => toJson(card, ctx)) };
    }),
    get: publicProcedure.input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board } = authAsBoardMember({ ctx, input });
      const boardCard = await BoardCardService.findById(board, {
        boardCardId: input.boardCardId,
        populate: [...POPULATE, 'boardColumn'],
      });
      const emailMessagesAsc = await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
        populate: ['domain', 'gmailAttachments'],
        orderBy: { externalCreatedAt: 'ASC' },
      });
      const comments = await CommentService.findCommentsByBoardCard(boardCard, {
        populate: COMMENT_POPULATE,
        orderBy: { createdAt: 'ASC' },
      });
      return {
        boardCard: toJson(boardCard, ctx),
        boardColumn: boardCard.loadedBoardColumn.toJson(),
        emailMessagesAsc: emailMessagesAsc.map((msg) => msg.toJson()),
        commentsAsc: comments.map((comment) => comment.toJson()),
      };
    }),
    markAsRead: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.markAsRead(board, {
          boardCardId: input.boardCardId,
          populate: POPULATE,
        });
        return { boardCard: toJson(boardCard, ctx) };
      }),
    markAsUnread: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.markAsUnread(board, {
          boardCardId: input.boardCardId,
          populate: POPULATE,
        });
        return { boardCard: toJson(boardCard, ctx) };
      }),
    setBoardColumn: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), boardColumnId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.setBoardColumn(board, {
          boardCardId: input.boardCardId,
          boardColumnId: input.boardColumnId,
          populate: POPULATE,
        });
        return { boardCard: toJson(boardCard, ctx) };
      }),
    setState: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), state: z.enum(Object.values(State)) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.setState(board, {
          boardCardId: input.boardCardId,
          state: input.state,
          populate: POPULATE,
        });
        return { boardCard: toJson(boardCard, ctx) };
      }),
  } satisfies TRPCRouterRecord,
};
