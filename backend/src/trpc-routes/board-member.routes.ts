import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { Role } from '@/entities/board-member';
import { BoardMemberService } from '@/services/board-member.service';

import { authAsBoardAdmin, publicProcedure } from '@/trpc-config';

export const BOARD_MEMBER_ROUTES = {
  boardMember: {
    setRole: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        const { board, user } = authAsBoardAdmin({ ctx, input });
        const boardMember = await BoardMemberService.setRole(board, {
          userId: input.userId,
          role: input.role,
          currentUser: user,
        });
        return { boardMember: boardMember.toJson() };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board, user } = authAsBoardAdmin({ ctx, input });
        await BoardMemberService.delete(board, { userId: input.userId, currentUser: user });
      }),
  } satisfies TRPCRouterRecord,
};
