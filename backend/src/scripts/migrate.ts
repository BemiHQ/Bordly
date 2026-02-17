import { RequestContext } from '@mikro-orm/postgresql';
import '@/utils/error-tracking';
import { Board } from '@/entities/board';
import { BoardCardReadPosition } from '@/entities/board-card-read-position';
import { orm } from '@/utils/orm';

const backfill = async () => {
  const boards = await orm.em.find(
    Board,
    {},
    { populate: ['boardMembers', 'boardColumns.boardCards.boardCardReadPositions'] },
  );
  for (const board of boards) {
    for (const boardCard of [...board.boardColumns].flatMap((col) => [...col.boardCards])) {
      for (const boardMember of board.boardMembers) {
        const memberReadPosition = boardCard.boardCardReadPositions.find((pos) => pos.user.id === boardMember.user.id);
        if (memberReadPosition) continue;

        const readPosition = new BoardCardReadPosition({
          boardCard,
          user: boardMember.user,
          lastReadAt: boardCard.lastEventAt,
        });
        orm.em.persist(readPosition);
      }
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
