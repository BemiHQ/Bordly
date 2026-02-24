import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardColumn } from '@/entities/board-column';
import { BoardColumnService } from '@/services/board-column.service';

import { authAsBoardMember, publicProcedure } from '@/trpc-config';

export const BOARD_COLUMN_ROUTES = {
  boardColumn: {
    create: publicProcedure
      .input(z.object({ boardId: z.uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardColumn = await BoardColumnService.create(board, { name: input.name });
        return { boardColumn: BoardColumn.toJson(boardColumn) };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardColumnId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        await BoardColumnService.delete(board, { boardColumnId: input.boardColumnId });
      }),
    setName: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardColumnId: z.uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardColumn = await BoardColumnService.setName(board, {
          boardColumnId: input.boardColumnId,
          name: input.name,
        });
        return { boardColumn: BoardColumn.toJson(boardColumn) };
      }),
    setPosition: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardColumnId: z.uuid(), position: z.number().int().min(0) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        await BoardColumnService.setPosition(board, {
          boardColumnId: input.boardColumnId,
          position: input.position,
        });
      }),
  } satisfies TRPCRouterRecord,
};
