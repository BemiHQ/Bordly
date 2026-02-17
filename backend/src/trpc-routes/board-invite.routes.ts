import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { Role } from '@/entities/board-member';
import { BoardInviteService } from '@/services/board-invite.service';

import { authAsBoardAdmin, authAsBoardMember, publicProcedure } from '@/trpc-config';

export const BOARD_INVITE_ROUTES = {
  boardInvite: {
    getBoardInvites: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board } = authAsBoardMember({ ctx, input });
      const boardInvites = await BoardInviteService.findPendingInvites(board);
      return { boardInvites: boardInvites.map((boardInvite) => boardInvite.toJson()) };
    }),
    create: publicProcedure
      .input(z.object({ boardId: z.uuid(), email: z.email(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        const { board, user } = authAsBoardAdmin({ ctx, input });
        const boardInvite = await BoardInviteService.create(board, {
          email: input.email,
          role: input.role,
          invitedBy: user,
        });
        return { boardInvite: boardInvite.toJson() };
      }),
    createMemberBoardInvites: publicProcedure
      .input(z.object({ boardId: z.uuid(), emails: z.array(z.email()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { board, user } = authAsBoardAdmin({ ctx, input });
        await BoardInviteService.createMemberBoardInvites(board, { emails: input.emails, invitedBy: user });
      }),
    setRole: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardInviteId: z.uuid(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardAdmin({ ctx, input });
        const boardInvite = await BoardInviteService.setRole(board, {
          boardInviteId: input.boardInviteId,
          role: input.role,
        });
        return { boardInvite: boardInvite.toJson() };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardInviteId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardAdmin({ ctx, input });
        await BoardInviteService.delete(board, { boardInviteId: input.boardInviteId });
      }),
  } satisfies TRPCRouterRecord,
};
