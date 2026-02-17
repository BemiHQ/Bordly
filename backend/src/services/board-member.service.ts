import type { Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import { BoardMember } from '@/entities/board-member';
import { orm } from '@/utils/orm';

export class BoardMemberService {
  static async findMembers<Hint extends string = never>(
    board: Board,
    { populate }: { populate?: Populate<BoardMember, Hint> } = {},
  ) {
    return orm.em.find(BoardMember, { board }, { populate });
  }
}
