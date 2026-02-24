import type { Populate } from '@mikro-orm/postgresql';

import type { Board } from '@/entities/board';
import { BoardCard } from '@/entities/board-card';
import { BoardCardReadPosition } from '@/entities/board-card-read-position';
import { BoardColumn } from '@/entities/board-column';
import { Comment } from '@/entities/comment';
import { EmailMessage } from '@/entities/email-message';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { orm } from '@/utils/orm';
import { BoardCardState } from '@/utils/shared';

export class BoardColumnService {
  static async findById<Hint extends string = never>(
    boardColumnId: string,
    { board, populate = [] }: { board: Board; populate?: Populate<BoardColumn, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardColumn, { id: boardColumnId, board: { id: board.id } }, { populate });
  }

  static async create(board: Board, { name }: { name: string }) {
    const allColumns = await orm.em.find(BoardColumn, { board: { id: board.id } });
    const position = allColumns.length;

    const boardColumn = new BoardColumn({ board, name, description: name, position });
    orm.em.persist(boardColumn);
    await orm.em.flush();

    return boardColumn;
  }

  static async delete(board: Board, { boardColumnId }: { boardColumnId: string }) {
    const boardColumn = await BoardColumnService.findById(boardColumnId, { board, populate: ['boardCards'] });
    const { boardCards } = boardColumn;

    const inboxBoardCards = boardCards.filter((card) => card.state === BoardCardState.INBOX);
    if (inboxBoardCards.length > 0) {
      throw new Error('Cannot delete column with inbox board cards');
    }

    await orm.em.transactional(async (em) => {
      const emailMessagesCondition = {
        externalThreadId: { $in: boardCards.map((c) => c.externalThreadId).filter((id): id is string => !!id) },
      };
      await em.nativeDelete(GmailAttachment, { emailMessage: emailMessagesCondition });
      await em.nativeDelete(EmailMessage, emailMessagesCondition);

      const boardCardsCondition = { id: { $in: boardCards.map((c) => c.id) } };
      await em.nativeDelete(Comment, { boardCard: boardCardsCondition });
      await em.nativeDelete(BoardCardReadPosition, { boardCard: boardCardsCondition });
      await em.nativeDelete(BoardCard, boardCardsCondition);

      await em.nativeDelete(BoardColumn, { id: boardColumn.id });
    });
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
