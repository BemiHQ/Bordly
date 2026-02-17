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

  static async edit<Hint extends string = never>(
    board: Board,
    {
      boardAccountId,
      receivingEmails,
      populate,
    }: { boardAccountId: string; receivingEmails?: string[]; populate?: Populate<BoardAccount, Hint> },
  ) {
    const boardAccount = await BoardAccountService.findById(boardAccountId, { populate });
    if (boardAccount.board.id !== board.id) throw new Error('Board account does not belong to this board');

    boardAccount.setReceivingEmails(receivingEmails);
    orm.em.persist(boardAccount);

    await orm.em.flush();
    return boardAccount;
  }
}
