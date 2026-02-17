import '@/utils/error-tracking';
import { orm } from '@/utils/orm';

(async () => {
  try {
    await orm.migrator.up();
  } finally {
    await orm?.close(true);
  }
})();
