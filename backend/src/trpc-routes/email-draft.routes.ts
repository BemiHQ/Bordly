import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardCardService } from '@/services/board-card.service';
import { EmailDraftService } from '@/services/email-draft.service';
import { authAsBoardMember, publicProcedure } from '@/trpc-config';
import { POPULATE as BOARD_CARD_POPULATE, toJson as boardCardToJson } from '@/trpc-routes/board-card.routes';

export const EMAIL_DRAFT_ROUTES = {
  emailDraft: {
    upsert: publicProcedure
      .input(
        z.object({
          boardId: z.uuid(),
          boardCardId: z.uuid(),
          subject: z.string(),
          from: z.string().min(1),
          to: z.array(z.string().min(1)).min(1).optional(),
          cc: z.array(z.string().min(1)).min(1).optional(),
          bcc: z.array(z.string().min(1)).min(1).optional(),
          bodyHtml: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const user = ctx.user!;
        const boardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: [...BOARD_CARD_POPULATE, 'boardColumn'],
        });
        const updatedBoardCard = await EmailDraftService.upsert(boardCard, { ...input, generated: false, user });
        return { boardCard: boardCardToJson(updatedBoardCard, ctx) };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });

        const boardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: ['emailDraft.fileAttachments'],
        });
        await EmailDraftService.delete(boardCard);
        return { success: true };
      }),
    send: publicProcedure
      .input(
        z.object({
          boardId: z.uuid(),
          boardCardId: z.uuid(),
          from: z.string().min(1),
          to: z.array(z.string().min(1)).min(1).optional(),
          cc: z.array(z.string().min(1)).min(1).optional(),
          bcc: z.array(z.string().min(1)).min(1).optional(),
          subject: z.string().optional(),
          bodyHtml: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardCard = await BoardCardService.findById(board, {
          boardCardId: input.boardCardId,
          populate: [...BOARD_CARD_POPULATE, 'gmailAccount.senderEmailAddresses', 'boardColumn.board.boardMembers'],
        });

        const { emailMessage, boardCard: updatedBoardCard } = await EmailDraftService.send(boardCard, {
          ...input,
          user: ctx.user!,
        });
        return {
          emailMessage: emailMessage.toJson(),
          boardCard: boardCardToJson(updatedBoardCard, ctx),
        };
      }),
  } satisfies TRPCRouterRecord,
};
