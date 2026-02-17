import { TRPCError, type TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardService } from '@/services/board.service';
import { BoardMemberService } from '@/services/board-member.service';
import { GmailAccountService } from '@/services/gmail-account.service';

import { authAsBoardAdmin, authAsBoardMember, publicProcedure } from '@/trpc-config';

export const BOARD_ROUTES = {
  board: {
    get: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board } = authAsBoardMember({ ctx, input });
      await BoardService.populate(board, ['boardColumns', 'gmailAccounts']);
      const boardMembers = await BoardMemberService.findMembers(board, { populate: ['user'] });
      return {
        board: board.toJson(),
        boardColumnsAsc: [...board.boardColumns].sort((a, b) => a.position - b.position).map((col) => col.toJson()),
        gmailAccounts: board.gmailAccounts.map((acc) => acc.toJson()),
        boardMembers: boardMembers.map((member) => member.toJson()),
      };
    }),
    setName: publicProcedure
      .input(z.object({ boardId: z.uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardAdmin({ ctx, input });
        const updatedBoard = await BoardService.setName(board, { name: input.name });
        return { board: updatedBoard.toJson() };
      }),
    createFirstBoard: publicProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { board, error } = await BoardService.createFirstBoard({ name: input.name, user: ctx.user });
      return { board: board?.toJson(), error };
    }),
    deleteGmailAccount: publicProcedure
      .input(z.object({ boardId: z.uuid(), gmailAccountId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardAdmin({ ctx, input });
        await GmailAccountService.deleteFromBoard(board, { gmailAccountId: input.gmailAccountId });
      }),
  } satisfies TRPCRouterRecord,
};
