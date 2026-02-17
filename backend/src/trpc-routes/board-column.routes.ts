import type { TRPCRouterRecord } from '@trpc/server';
import { z } from 'zod';
import { BoardColumnService } from '@/services/board-column.service';

import { authAsBoardMember, publicProcedure } from '@/trpc-config';

export const BOARD_COLUMN_ROUTES = {
  boardColumn: {
    setName: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardColumnId: z.uuid(), name: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { board } = authAsBoardMember({ ctx, input });
        const boardColumn = await BoardColumnService.setName(board, {
          boardColumnId: input.boardColumnId,
          name: input.name,
        });
        return { boardColumn: boardColumn.toJson() };
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
