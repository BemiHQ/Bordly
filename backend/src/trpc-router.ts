import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';

import { BoardService } from '@/services/board.service';
import { createTRPCRouter, publicProcedure } from '@/utils/trpc';

const userRouter = {
  getCurrentUser: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return ctx.user.toJson();
  }),
} satisfies TRPCRouterRecord;

const boardRouter = {
  createBoard: publicProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    if (!ctx.user) throw new Error('Not authenticated');
    const board = await BoardService.create({ name: input.name, user: ctx.user });
    return board.toJson();
  }),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
  user: userRouter,
  board: boardRouter,
});

export type TRPCRouter = typeof trpcRouter;
