import type { Populate } from '@mikro-orm/postgresql';

import type { Board } from '@/entities/board';
import { BoardCard, State } from '@/entities/board-card';
import type { GmailAccount } from '@/entities/gmail-account';
import { orm } from '@/utils/orm';

export class BoardCardService {
  static async findAndBuildBoardCardByThreadId<Hint extends string = never>(args: {
    gmailAccount: GmailAccount;
    externalThreadIds: string[];
    populate?: Populate<BoardCard, Hint>;
  }) {
    const { gmailAccount, externalThreadIds, populate = [] } = args;
    if (externalThreadIds.length === 0) return {};

    const boardCards = await orm.em.find(
      BoardCard,
      { gmailAccount, externalThreadId: { $in: externalThreadIds } },
      { populate },
    );
    const boardCardByThreadId: Record<string, BoardCard> = {};
    for (const boardCard of boardCards) {
      boardCardByThreadId[boardCard.externalThreadId] = boardCard;
    }
    return boardCardByThreadId;
  }

  static async findCardsByBoard<Hint extends string = never>(
    board: Board,
    { state = State.INBOX, populate = [] }: { state?: State; populate?: Populate<BoardCard, Hint> },
  ) {
    return orm.em.find(BoardCard, { state, boardColumn: { board: { id: board.id } } }, { populate });
  }
}
