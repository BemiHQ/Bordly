import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { Role } from '@/entities/board-member';
import { BoardService } from '@/services/board.service';
import { BoardMemberService } from '@/services/board-member.service';

import { publicProcedure } from '@/trpc-config';

export const BOARD_MEMBER_ROUTES = {
  boardMember: {
    getBoardMembers: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
      const boardMembers = await BoardMemberService.findMembers(board, { populate: ['user'] });
      return { boardMembers: boardMembers.map((member) => member.toJson()) };
    }),
    setRole: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        const boardMember = await BoardMemberService.setRole(board, {
          userId: input.userId,
          role: input.role,
          currentUser: ctx.user,
        });
        return { boardMember: boardMember.toJson() };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        await BoardMemberService.delete(board, { userId: input.userId, currentUser: ctx.user });
      }),
  } satisfies TRPCRouterRecord,
};
