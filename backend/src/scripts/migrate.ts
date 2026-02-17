import { RequestContext } from '@mikro-orm/postgresql';
import { GmailAccount } from '@/entities/gmail-account';
import { EmailAddressService } from '@/services/email-address.service';
import '@/utils/error-tracking';
import { orm } from '@/utils/orm';

const backfill = async () => {
  const gmailAccounts = await orm.em.find(GmailAccount, {});

  for (const gmailAccount of gmailAccounts) {
    console.log(`Processing Gmail account: ${gmailAccount.email}`);
    try {
      await EmailAddressService.createAddresses(gmailAccount);
      console.log(`Successfully created email addresses for: ${gmailAccount.email}`);
    } catch (error) {
      console.error(`Error processing ${gmailAccount.email}:`, error);
    }
  }
};

(async () => {
  try {
    await orm.migrator.up();
    await RequestContext.create(orm.em, backfill);
  } finally {
    await orm?.close(true);
  }
})();
