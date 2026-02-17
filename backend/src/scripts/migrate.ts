import { RequestContext } from '@mikro-orm/postgresql';
import { BoardAccount } from '@/entities/board-account';
import { GmailAccount } from '@/entities/gmail-account';
import '@/utils/error-tracking';
import { orm } from '@/utils/orm';

const backfill = async () => {
  const gmailAccounts = await orm.em.find(GmailAccount, { board: { $ne: null } }, { populate: ['board'] });

  for (const gmailAccount of gmailAccounts) {
    const existingBoardAccount = await orm.em.findOne(BoardAccount, {
      board: gmailAccount.board,
      gmailAccount,
    });

    if (!existingBoardAccount) {
      const boardAccount = new BoardAccount({ board: gmailAccount.board!, gmailAccount });
      orm.em.persist(boardAccount);
    }
  }

  await orm.em.flush();
};

(async () => {
  try {
    await orm.migrator.up();
    await RequestContext.create(orm.em, backfill);
  } finally {
    await orm?.close(true);
  }
})();
