import type { TRPCRouterRecord } from '@trpc/server';

import { publicProcedure } from '@/trpc-config';

export const USER_ROUTES = {
  user: {
    getCurrentUser: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return { currentUser: null };
      return {
        currentUser: ctx.user.toJson(),
        boards: ctx.user.boardMembers.getItems().map((bm) => bm.board.toJson()),
      };
    }),
  } satisfies TRPCRouterRecord,
};
