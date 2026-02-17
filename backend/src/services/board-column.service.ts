import type { Populate } from '@mikro-orm/postgresql';

import type { Board } from '@/entities/board';
import { BoardColumn } from '@/entities/board-column';
import { orm } from '@/utils/orm';

export class BoardColumnService {
  static async findById<Hint extends string = never>(
    boardColumnId: string,
    { board, populate = [] }: { board: Board; populate?: Populate<BoardColumn, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardColumn, { id: boardColumnId, board: { id: board.id } }, { populate });
  }

  static async setName<Hint extends string = never>(
    board: Board,
    {
      boardColumnId,
      name,
      populate = [],
    }: { boardColumnId: string; name: string; populate?: Populate<BoardColumn, Hint> },
  ) {
    const boardColumn = await BoardColumnService.findById(boardColumnId, { board, populate });

    boardColumn.setName(name);
    orm.em.persist(boardColumn);

    await orm.em.flush();
    return boardColumn;
  }
}
