import { RequestContext } from '@mikro-orm/postgresql';
import '@/utils/error-tracking';
import { Board } from '@/entities/board';
import { BoardMember, Role } from '@/entities/board-member';
import { BORDLY_USER_ID, User } from '@/entities/user';
import { orm } from '@/utils/orm';

const backfill = async () => {
  let bordlyUser = await orm.em.findOne(User, { id: BORDLY_USER_ID });
  if (bordlyUser) return;

  bordlyUser = new User({
    email: 'no-reply@bordly.ai',
    name: 'Bordly',
    photoUrl: '/apple-touch-icon.png',
  });
  bordlyUser.id = BORDLY_USER_ID;
  orm.em.persist(bordlyUser);

  const boards = await orm.em.find(Board, {});
  for (const board of boards) {
    const boardMember = new BoardMember({ board, user: bordlyUser, role: Role.AGENT });
    orm.em.persist(boardMember);
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
