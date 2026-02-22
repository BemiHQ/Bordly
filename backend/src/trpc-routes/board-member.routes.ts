import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { type BoardMemberMemory, Role } from '@/entities/board-member';
import { BoardMemberService } from '@/services/board-member.service';
import { authAsBoardAdmin, authAsBoardMember, publicProcedure } from '@/trpc-config';
import type { MemoryFormality } from '@/utils/shared';

export const BOARD_MEMBER_ROUTES = {
  boardMember: {
    setRole: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        const { board, user } = authAsBoardAdmin({ ctx, input });
        await BoardMemberService.setRole(board, { userId: input.userId, role: input.role, currentUser: user });
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board, user } = authAsBoardAdmin({ ctx, input });
        await BoardMemberService.delete(board, { userId: input.userId, currentUser: user });
      }),
    memory: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      const { board, user } = authAsBoardMember({ ctx, input });
      const boardMember = await BoardMemberService.findByUserId(board, { userId: user.id, populate: ['memory'] });
      return { memory: boardMember.memory as BoardMemberMemory | null };
    }),
    setMemory: publicProcedure
      .input(
        z.object({
          boardId: z.uuid(),
          memory: z.object({
            greeting: z.string().nullable(),
            opener: z.string().nullable(),
            signature: z.string().nullable(),
            formality: z.string().nullable(),
            meetingLink: z.string().nullable(),
          }),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const { board, user } = authAsBoardMember({ ctx, input });
        const boardMember = await BoardMemberService.findByUserId(board, { userId: user.id, populate: ['memory'] });
        const { memory } = await BoardMemberService.setMemory(boardMember, {
          greeting: input.memory.greeting as string | undefined,
          opener: input.memory.opener as string | undefined,
          signature: input.memory.signature as string | undefined,
          formality: input.memory.formality as MemoryFormality | undefined,
          meetingLink: input.memory.meetingLink as string | undefined,
        });
        return { memory: memory as BoardMemberMemory };
      }),
  } satisfies TRPCRouterRecord,
};
