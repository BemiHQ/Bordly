import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { EmailDraftService } from '@/services/email-draft.service';
import { authAsBoardMember, publicProcedure } from '@/trpc-config';

export const EMAIL_DRAFT_ROUTES = {
  emailDraft: {
    upsert: publicProcedure
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
        const emailDraft = await EmailDraftService.upsert(board, { ...input, generated: false });
        return { emailDraft: emailDraft.toJson() };
      }),
  } satisfies TRPCRouterRecord,
};
