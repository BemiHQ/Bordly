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

  static async setPosition<Hint extends string = never>(
    board: Board,
    {
      boardColumnId,
      position,
      populate = [],
    }: { boardColumnId: string; position: number; populate?: Populate<BoardColumn, Hint> },
  ) {
    const boardColumn = await BoardColumnService.findById(boardColumnId, { board, populate });
    const allColumns = await orm.em.find(BoardColumn, { board: { id: board.id } }, { orderBy: { position: 'ASC' } });
    const oldPosition = boardColumn.position;
    if (oldPosition === position) return boardColumn;

    // Move all columns to temporary high positions to avoid unique constraint violations
    const offset = allColumns.length;
    allColumns.forEach((col, i) => {
      col.setPosition(offset + i);
      orm.em.persist(col);
    });
    await orm.em.flush();

    // Reorder columns and assign final positions
    const reorderedColumns = allColumns.filter((col) => col.id !== boardColumnId);
    reorderedColumns.splice(position, 0, boardColumn);
    reorderedColumns.forEach((col, i) => {
      col.setPosition(i);
      orm.em.persist(col);
    });
    await orm.em.flush();

    return boardColumn;
  }
}
