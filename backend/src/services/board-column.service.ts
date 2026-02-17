import type { Populate } from '@mikro-orm/postgresql';

import type { Board } from '@/entities/board';
import { BoardColumn } from '@/entities/board-column';
import { orm } from '@/utils/orm';

export class BoardColumnService {
  static async findById<Hint extends string = never>(
    boardCardId: string,
    { board, populate = [] }: { board: Board; populate?: Populate<BoardColumn, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardColumn, { id: boardCardId, board: { id: board.id } }, { populate });
  }
}
