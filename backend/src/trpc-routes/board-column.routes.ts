import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardService } from '@/services/board.service';
import { BoardColumnService } from '@/services/board-column.service';

import { publicProcedure } from '@/trpc-config';

export const BOARD_COLUMN_ROUTES = {
  boardColumn: {
    setName: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardColumnId: z.uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        const boardColumn = await BoardColumnService.setName(board, {
          boardColumnId: input.boardColumnId,
          name: input.name,
        });
        return { boardColumn: boardColumn.toJson() };
      }),
    setPosition: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardColumnId: z.uuid(), position: z.number().int().min(0) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        await BoardColumnService.setPosition(board, {
          boardColumnId: input.boardColumnId,
          position: input.position,
        });
      }),
  } satisfies TRPCRouterRecord,
};
