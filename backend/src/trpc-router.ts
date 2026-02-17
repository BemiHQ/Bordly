import type { TRPCRouterRecord } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '@/utils/trpc';

const userRouter = {
  getCurrentUser: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) {
      return null;
    }
    return ctx.user.toJson();
  }),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
  user: userRouter,
});

export type TRPCRouter = typeof trpcRouter;
