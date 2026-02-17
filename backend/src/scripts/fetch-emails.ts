import { RequestContext } from '@mikro-orm/postgresql';
import { EmailMessageService } from '@/services/email-message.service';
import { reportError } from '@/utils/error-tracking';
import { orm } from '@/utils/orm';

(async () => {
  try {
    await RequestContext.create(orm.em, async () => {
      await EmailMessageService.createNewEmailMessages();
    });
  } catch (error) {
    reportError(error);
    process.exit(1);
  }
})();
