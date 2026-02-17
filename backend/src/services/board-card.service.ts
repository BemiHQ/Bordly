import type { Populate } from '@mikro-orm/postgresql';

import { BoardCard, State } from '@/entities/board-card';
import type { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class BoardCardService {
  static tryFindByGmailAccountAndExternalThreadId({
    gmailAccount,
    externalThreadId,
  }: {
    gmailAccount: GmailAccount;
    externalThreadId: string;
  }) {
    return orm.em.findOne(BoardCard, { gmailAccount, externalThreadId });
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
