import type { TRPCRouterRecord } from '@trpc/server';
import type { BoardMember } from '@/entities/board-member';
import { publicProcedure } from '@/trpc-config';

const toBoardJson = (boardMember: BoardMember) => {
  return { boardMemberId: boardMember.id, ...boardMember.loadedBoard.toJson() };
};

export const USER_ROUTES = {
  user: {
    getCurrentUser: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return { currentUser: null };
      return {
        currentUser: ctx.user.toJson(),
        boards: ctx.user.boardMembers.map(toBoardJson),
      };
    }),
  } satisfies TRPCRouterRecord,
};
