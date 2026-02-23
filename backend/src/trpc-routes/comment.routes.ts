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
          text: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: BOARD_CARD_POPULATE,
        });
        const comment = await CommentService.create(boardCard, {
          board,
          user: ctx.user!,
          text: input.text,
          userTimeZone: ctx.userTimeZone,
        });

        return {
          comment: Comment.toJson(comment),
          boardCard: boardCardToJson(boardCard, ctx),
        };
      }),
    edit: publicProcedure
      .input(
        z.object({
          boardId: z.uuid(),
          boardCardId: z.uuid(),
          commentId: z.uuid(),
          text: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: [...BOARD_CARD_POPULATE, 'boardColumn'],
        });
        const comment = await CommentService.edit(boardCard, {
          board,
          user: ctx.user!,
          commentId: input.commentId,
          text: input.text,
          userTimeZone: ctx.userTimeZone,
          populate: POPULATE,
        });

        return {
          comment: Comment.toJson(comment),
          boardCard: boardCardToJson(boardCard, ctx),
        };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), commentId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: BOARD_CARD_POPULATE,
        });
        await CommentService.delete(boardCard, { commentId: input.commentId });
        return { boardCard: boardCardToJson(boardCard, ctx) };
      }),
  } satisfies TRPCRouterRecord,
};
