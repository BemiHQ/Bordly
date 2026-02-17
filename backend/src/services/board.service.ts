import type { Populate } from '@mikro-orm/postgresql';
import { Board } from '@/entities/board';
import { BoardMember } from '@/entities/board-member';
import type { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { enqueue, QUEUES } from '@/pg-boss-queues';
import { orm } from '@/utils/orm';

export class BoardService {
  static async findByIdForUser<Hint extends string = never>(
    boardId: string,
    { user, populate = [] }: { user: User; populate?: Populate<Board, Hint> },
  ) {
    return orm.em.findOneOrFail(Board, { id: boardId, boardMembers: { user } }, { populate });
  }

  static async createFirstBoard({ name, user }: { name: string; user: User }) {
    const board = new Board({ name });
    const boardMember = new BoardMember({ board, user });

    await orm.em.populate(user, ['gmailAccounts']);
    if (user.gmailAccounts.length !== 1) {
      throw new Error('User must have exactly one Gmail account to create a board');
    }
    const gmailAccount = user.gmailAccounts[0] as GmailAccount;
    gmailAccount.board = board;

    await orm.em.persist([board, boardMember, gmailAccount]).flush();
    user.boards.add(board);

    await enqueue(QUEUES.CREATE_INITIAL_EMAIL_MESSAGES, { gmailAccountId: gmailAccount.id });

    return board;
  }
}
