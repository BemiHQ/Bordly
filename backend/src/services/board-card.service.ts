import type { Board } from '@/entities/board';
import { BoardCard, State } from '@/entities/board-card';
import type { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class BoardCardService {
  static tryFindByBoardAndExternalThreadId({ board, externalThreadId }: { board: Board; externalThreadId: string }) {
    return orm.em.findOne(BoardCard, { board: board, externalThreadId });
  }

  static findCardsByBoardId<Hint extends string = never>(
    boardId: string,
    { user, state = State.INBOX, populate = [] }: { user: User; state?: State; populate?: Populate<BoardCard, Hint> },
  ) {
    return orm.em.find(BoardCard, { board: { id: boardId, users: { id: user.id } }, state }, { populate });
  }
}
