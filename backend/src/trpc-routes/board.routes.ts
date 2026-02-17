import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardService } from '@/services/board.service';
import { GmailAccountService } from '@/services/gmail-account.service';

import { publicProcedure } from '@/trpc-config';

export const BOARD_ROUTES = {
  board: {
    get: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
      await BoardService.populate(board, ['boardColumns', 'gmailAccounts']);
      return {
        board: board.toJson(),
        boardColumnsAsc: [...board.boardColumns].sort((a, b) => a.position - b.position).map((col) => col.toJson()),
        gmailAccounts: board.gmailAccounts.map((acc) => acc.toJson()),
      };
    }),
    setName: publicProcedure
      .input(z.object({ boardId: z.uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        const updatedBoard = await BoardService.setName(board, { name: input.name });
        return { board: updatedBoard.toJson() };
      }),
    createFirstBoard: publicProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const { board, error } = await BoardService.createFirstBoard({ name: input.name, user: ctx.user });
      return { board: board?.toJson(), error };
    }),
    deleteGmailAccount: publicProcedure
      .input(z.object({ boardId: z.uuid(), gmailAccountId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        await GmailAccountService.deleteFromBoard(board, { gmailAccountId: input.gmailAccountId });
      }),
  } satisfies TRPCRouterRecord,
};
