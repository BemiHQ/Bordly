import type { Populate } from '@mikro-orm/postgresql';

import { BoardCard, State } from '@/entities/board-card';
import type { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class BoardCardService {
  static async findAndBuildBoardCardByThreadId<Hint extends string = never>(args: {
    gmailAccount: GmailAccount;
    externalThreadIds: string[];
    populate?: Populate<BoardCard, Hint>;
  }) {
    const { gmailAccount, externalThreadIds, populate = [] } = args;
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

  static findCardsByBoardId<Hint extends string = never>(
    boardId: string,
    { user, state = State.INBOX, populate = [] }: { user: User; state?: State; populate?: Populate<BoardCard, Hint> },
  ) {
    return orm.em.find(
      BoardCard,
      {
        state,
        boardColumn: {
          board: {
            id: boardId,
            users: { id: user.id },
          },
        },
      },
      { populate },
    );
  }
}
