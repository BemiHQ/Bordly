import { TRPCError, type TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardColumn } from '@/entities/board-column';
import { BoardMember } from '@/entities/board-member';
import { BoardService } from '@/services/board.service';
import { BoardAccountService } from '@/services/board-account.service';
import { BoardMemberService } from '@/services/board-member.service';

import { authAsBoardAdmin, authAsBoardMember, publicProcedure } from '@/trpc-config';

export const BOARD_ROUTES = {
  board: {
    get: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board } = authAsBoardMember({ ctx, input });
      await BoardService.populate(board, ['boardColumns', 'boardAccounts.gmailAccount']);
      const boardMembers = await BoardMemberService.findMembers(board, {
        populate: ['user.gmailAccount.senderEmailAddresses'],
      });
      return {
        board: board.toJson(),
        boardColumnsAsc: [...board.boardColumns].sort((a, b) => a.position - b.position).map(BoardColumn.toJson),
        boardAccounts: board.boardAccounts.map((boardAccount) => boardAccount.toJson()),
        boardMembers: boardMembers.map(BoardMember.toJson),
      };
    }),
    setName: publicProcedure
      .input(z.object({ boardId: z.uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardAdmin({ ctx, input });
        const updatedBoard = await BoardService.setName(board, { name: input.name });
        return { board: updatedBoard.toJson() };
      }),
    createFirstBoard: publicProcedure
      .input(z.object({ name: z.string().min(1), receivingEmails: z.array(z.email()).optional() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const { board, error } = await BoardService.createFirstBoard({
          name: input.name,
          user: ctx.user,
          receivingEmails: input.receivingEmails,
        });
        return { board: board?.toJson(), error };
      }),
    deleteBoardAccount: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardAccountId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardAdmin({ ctx, input });
        await BoardAccountService.deleteFromBoard(board, { boardAccountId: input.boardAccountId });
      }),
  } satisfies TRPCRouterRecord,
};
