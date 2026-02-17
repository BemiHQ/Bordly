import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardAccountService } from '@/services/board-account.service';
import { authAsBoardAdmin, publicProcedure } from '@/trpc-config';

const POPULATE = ['gmailAccount'] as const;

export const BOARD_ACCOUNT_ROUTES = {
  boardAccount: {
    edit: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardAccountId: z.uuid(), receivingEmails: z.array(z.email()).optional() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardAdmin({ ctx, input });
        const boardAccount = await BoardAccountService.edit(board, {
          boardAccountId: input.boardAccountId,
          receivingEmails: input.receivingEmails,
          populate: POPULATE,
        });
        return { boardAccount: boardAccount.toJson() };
      }),
  } satisfies TRPCRouterRecord,
};
