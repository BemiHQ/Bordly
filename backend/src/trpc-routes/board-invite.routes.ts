import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { Role } from '@/entities/board-member';
import { BoardService } from '@/services/board.service';
import { BoardInviteService } from '@/services/board-invite.service';

import { publicProcedure } from '@/trpc-config';

export const BOARD_INVITE_ROUTES = {
  boardInvite: {
    getBoardInvites: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
      const boardInvites = await BoardInviteService.findPendingInvites(board);
      return { boardInvites: boardInvites.map((boardInvite) => boardInvite.toJson()) };
    }),
    create: publicProcedure
      .input(z.object({ boardId: z.uuid(), email: z.email(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        const boardInvite = await BoardInviteService.create(board, {
          email: input.email,
          role: input.role,
          invitedBy: ctx.user,
        });
        return { boardInvite: boardInvite.toJson() };
      }),
    createMemberBoardInvites: publicProcedure
      .input(z.object({ boardId: z.uuid(), emails: z.array(z.email()) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        await BoardInviteService.createMemberBoardInvites(board, { emails: input.emails, invitedBy: ctx.user });
      }),
    setRole: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardInviteId: z.uuid(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        const boardInvite = await BoardInviteService.setRole(board, {
          boardInviteId: input.boardInviteId,
          role: input.role,
        });
        return { boardInvite: boardInvite.toJson() };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardInviteId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        await BoardInviteService.delete(board, { boardInviteId: input.boardInviteId });
      }),
  } satisfies TRPCRouterRecord,
};
