import type { Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import { BoardMember, type Role } from '@/entities/board-member';
import type { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class BoardMemberService {
  static async findMembers<Hint extends string = never>(
    board: Board,
    { populate }: { populate?: Populate<BoardMember, Hint> } = {},
  ) {
    return orm.em.find(BoardMember, { board }, { populate });
  }

  static async setRole(board: Board, { userId, role, currentUser }: { userId: string; role: Role; currentUser: User }) {
    if (currentUser.id === userId) throw new Error('Cannot change your own role');

    const boardMember = await BoardMemberService.findByUserId(board, { userId, populate: ['assignedBoardCards'] });

    boardMember.setRole(role);
    orm.em.persist(boardMember);

    for (const boardCard of boardMember.assignedBoardCards) {
      boardCard.assignedBoardMember = undefined;
      orm.em.persist(boardCard);
    }

    await orm.em.flush();

    return boardMember;
  }

  static async delete(board: Board, { userId, currentUser }: { userId: string; currentUser: User }) {
    if (currentUser.id === userId) throw new Error('Cannot remove yourself from the board');

    const boardMember = await BoardMemberService.findByUserId(board, { userId });

    await orm.em.remove(boardMember).flush();
  }

  static async findById<Hint extends string = never>(
    board: Board,
    { boardMemberId, populate = [] }: { boardMemberId: string; populate?: Populate<BoardMember, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardMember, { board, id: boardMemberId }, { populate });
  }

  private static async findByUserId<Hint extends string = never>(
    board: Board,
    { userId, populate = [] }: { userId: string; populate?: Populate<BoardMember, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardMember, { board, user: userId }, { populate });
  }
}
