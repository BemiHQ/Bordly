import { RequestContext } from '@mikro-orm/postgresql';
import '@/utils/error-tracking';
import { orm } from '@/utils/orm';

const backfill = async () => {};

(async () => {
  try {
    await orm.migrator.up();
    await RequestContext.create(orm.em, backfill);
  } finally {
    await orm?.close(true);
  }
})();
