import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { Comment } from '@/entities/comment';
import { BoardCardService } from '@/services/board-card.service';
import { CommentService } from '@/services/comment.service';
import { authAsBoardMember, publicProcedure } from '@/trpc-config';
import { POPULATE as BOARD_CARD_POPULATE, toJson as boardCardToJson } from '@/trpc-routes/board-card.routes';

export const POPULATE = ['user'] as const;

export const COMMENT_ROUTES = {
  comment: {
    create: publicProcedure
      .input(
        z.object({
          boardId: z.uuid(),
          boardCardId: z.uuid(),
          contentHtml: z.string().min(1),
          contentText: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const initialBoardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: BOARD_CARD_POPULATE,
        });
        const { boardCard, comment } = await CommentService.create(initialBoardCard, {
          board,
          user: ctx.user!,
          contentHtml: input.contentHtml,
          contentText: input.contentText,
          userTimeZone: ctx.userTimeZone,
        });

        return {
          comment: Comment.toJson(comment),
          boardCard: boardCardToJson(boardCard as typeof initialBoardCard, ctx),
        };
      }),
    edit: publicProcedure
      .input(
        z.object({
          boardId: z.uuid(),
          boardCardId: z.uuid(),
          commentId: z.uuid(),
          contentHtml: z.string().min(1),
          contentText: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const initialBoardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: [...BOARD_CARD_POPULATE, 'boardColumn'],
        });
        const { boardCard, comment } = await CommentService.edit(initialBoardCard, {
          board,
          user: ctx.user!,
          commentId: input.commentId,
          contentHtml: input.contentHtml,
          contentText: input.contentText,
          userTimeZone: ctx.userTimeZone,
          populate: POPULATE,
        });

        return {
          comment: Comment.toJson(comment),
          boardCard: boardCardToJson(boardCard as typeof initialBoardCard, ctx),
        };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), commentId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const initialBoardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: BOARD_CARD_POPULATE,
        });
        const boardCard = await CommentService.delete(initialBoardCard, { commentId: input.commentId });
        return { boardCard: boardCardToJson(boardCard as typeof initialBoardCard, ctx) };
      }),
  } satisfies TRPCRouterRecord,
};
