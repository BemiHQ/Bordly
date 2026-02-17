import { RequestContext } from '@mikro-orm/postgresql';
import { EmailMessageService } from '@/services/email-message.service';
import { reportError } from '@/utils/error-tracking';
import { orm } from '@/utils/orm';
import { sleep } from '@/utils/time';

const INTERVAL_MS = 30 * 1_000; // 30 seconds

(async () => {
  try {
    while (true) {
      await RequestContext.create(orm.em, async () => {
        await EmailMessageService.createNewEmailMessages();
      });
      console.log(`Waiting for ${INTERVAL_MS / 1_000} seconds before next fetch...`);
      await sleep(INTERVAL_MS);
    }
  } catch (error) {
    reportError(error);
    process.exit(1);
  }
})();
