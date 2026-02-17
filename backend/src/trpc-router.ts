import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';

import { BoardService } from '@/services/board.service';
import { createTRPCRouter, publicProcedure } from '@/utils/trpc';
import { BoardInviteService } from './services/board-invite.service';

const userRouter = {
  getCurrentUser: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return ctx.user.toJson();
  }),
} satisfies TRPCRouterRecord;

const boardRouter = {
  createFirstBoard: publicProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    if (!ctx.user) throw new Error('Not authenticated');
    const board = await BoardService.createFirstBoard({ name: input.name, user: ctx.user });
    return board.toJson();
  }),
} satisfies TRPCRouterRecord;

const boardInviteRouter = {
  createInvites: publicProcedure
    .input(z.object({ boardId: z.uuid(), emails: z.array(z.email()) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const invites = await BoardInviteService.createInvites({
        boardId: input.boardId,
        emails: input.emails,
        invitedBy: ctx.user,
      });
      return invites.map((invite) => invite.toJson());
    }),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
  user: userRouter,
  board: boardRouter,
  boardInvite: boardInviteRouter,
});

export type TRPCRouter = typeof trpcRouter;
