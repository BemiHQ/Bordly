import type { AutoPath, PopulatePath } from '@mikro-orm/postgresql';
import { Board } from '@/entities/board';
import { BoardMember, Role } from '@/entities/board-member';
import type { User } from '@/entities/user';
import { enqueue, QUEUES } from '@/pg-boss-queues';
import { GmailAccountService } from '@/services/gmail-account.service';
import { UserService } from '@/services/user.service';
import { Emailer, HI_EMAIL } from '@/utils/emailer';
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
    await orm.em.populate(user, ['gmailAccount']);
    const { gmailAccount } = user;
    if (!(await GmailAccountService.hasGmailAccess(gmailAccount))) {
      return { board: undefined, error: ERRORS.NO_GMAIL_ACCESS };
    }

    const bordlyUser = await UserService.bordlyUser();
    const board = new Board({ name });
    const boardMember = new BoardMember({ board, user, role: Role.ADMIN });
    const bordlyBoardMember = new BoardMember({ board, user: bordlyUser, role: Role.AGENT });

    gmailAccount.addToBoard(board);
    user.boardMembers.add(boardMember);
    orm.em.persist([board, boardMember, bordlyBoardMember, gmailAccount]);

    await orm.em.flush();
    await enqueue(QUEUES.CREATE_INITIAL_EMAIL_MESSAGES, { gmailAccountId: gmailAccount.id });

    return { board, error: undefined };
  }

  static async sendWelcomeEmail(user: User) {
    await Emailer.send({
      from: HI_EMAIL,
      to: [user.email],
      subject: `Welcome to Bordly, ${user.firstName}!`,
      bodyText: `Hi ${user.firstName},

Welcome to Bordly! We're excited to have you on board.

If you have any questions or feedback, feel free to reply to this email.

Best,
Bordly Team`,
    });
  }
}
