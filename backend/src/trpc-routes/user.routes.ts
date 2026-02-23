import type { TRPCRouterRecord } from '@trpc/server';
import type { BoardMember } from '@/entities/board-member';
import { User } from '@/entities/user';
import { publicProcedure } from '@/trpc-config';

const toBoardJson = (boardMember: BoardMember) => {
  return { boardMemberId: boardMember.id, ...boardMember.loadedBoard.toJson() };
};

export const USER_ROUTES = {
  user: {
    getCurrentUser: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return { currentUser: null };
      return {
        currentUser: User.toJson(ctx.user),
        boards: ctx.user.boardMembers.map(toBoardJson),
      };
    }),
  } satisfies TRPCRouterRecord,
};
