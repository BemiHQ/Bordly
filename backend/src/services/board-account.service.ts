import type { Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import { BoardAccount } from '@/entities/board-account';
import { orm } from '@/utils/orm';

export class BoardAccountService {
  static async findAccountsByBoard<Hint extends string = never>(
    board: Board,
    { populate }: { populate?: Populate<BoardAccount, Hint> } = {},
  ) {
    return orm.em.find(BoardAccount, { board }, { populate });
  }

  static async findById<Hint extends string = never>(
    id: string,
    { populate }: { populate?: Populate<BoardAccount, Hint> } = {},
  ) {
    return orm.em.findOneOrFail(BoardAccount, { id }, { populate });
  }
}
