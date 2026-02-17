import type { AutoPath, PopulatePath } from '@mikro-orm/postgresql';
import { Board } from '@/entities/board';
import { BoardMember, Role } from '@/entities/board-member';
import type { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { enqueue, QUEUES } from '@/pg-boss-queues';
import { GmailAccountService } from '@/services/gmail-account.service';
import { orm } from '@/utils/orm';
import { ERRORS } from '@/utils/shared';

export class BoardService {
  static tryFindAsAdmin(boardId: string, { user }: { user: User }) {
    return user.boardMembers.find((bm) => bm.board.id === boardId && bm.role === Role.ADMIN)?.loadedBoard;
  }

  static tryFindAsMember(boardId: string, { user }: { user: User }) {
    return user.boardMembers.find((bm) => bm.board.id === boardId && [Role.ADMIN, Role.MEMBER].includes(bm.role))
      ?.loadedBoard;
  }

  static async populate<Hint extends string = never>(
    board: Board,
    populate: readonly AutoPath<Board, Hint, PopulatePath.ALL>[],
  ) {
    await orm.em.populate(board, populate);
    return board;
  }

  static async setName(board: Board, { name }: { name: string }) {
    board.setName(name);
    orm.em.persist(board);
    await orm.em.flush();
    return board;
  }

  static async createFirstBoard({ name, user }: { name: string; user: User }) {
    const board = new Board({ name });
    const boardMember = new BoardMember({ board, user, role: Role.ADMIN });

    await orm.em.populate(user, ['gmailAccounts']);
    if (user.gmailAccounts.length !== 1) {
      throw new Error('User must have exactly one Gmail account to create a board');
    }

    const gmailAccount = user.gmailAccounts[0] as GmailAccount;
    if (!(await GmailAccountService.hasGmailAccess(gmailAccount))) {
      return { board: undefined, error: ERRORS.NO_GMAIL_ACCESS };
    }

    gmailAccount.addToBoard(board);
    user.boardMembers.add(boardMember);
    orm.em.persist([board, boardMember, gmailAccount]);

    await orm.em.flush();
    await enqueue(QUEUES.CREATE_INITIAL_EMAIL_MESSAGES, { gmailAccountId: gmailAccount.id });

    return { board, error: undefined };
  }
}
