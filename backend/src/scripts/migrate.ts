import { RequestContext } from '@mikro-orm/postgresql';
import { GmailAccount } from '@/entities/gmail-account';
import '@/utils/error-tracking';
import { Encryption } from '@/utils/encryption';
import { EncryptionOld } from '@/utils/encryption-old';
import { orm } from '@/utils/orm';

const backfill = async () => {
  const gmailAccounts = await orm.em.findAll(GmailAccount);

  console.log(`Migrating ${gmailAccounts.length} Gmail accounts to new encryption...`);

  for (const account of gmailAccounts) {
    try {
      if (account.accessTokenEncrypted.startsWith('v1|')) {
        console.log(`Skipping already migrated account: ${account.email}`);
        continue;
      }

      // Decrypt with old encryption
      const accessToken = EncryptionOld.decrypt(account.accessTokenEncrypted);
      const refreshToken = EncryptionOld.decrypt(account.refreshTokenEncrypted);

      // Re-encrypt with new encryption
      account.accessTokenEncrypted = Encryption.encrypt(accessToken, { salt: account.externalId });
      account.refreshTokenEncrypted = Encryption.encrypt(refreshToken, { salt: account.externalId });
      orm.em.persist(account);
      console.log(`Migrated account: ${account.email}`);
    } catch (error) {
      console.error(`Failed to migrate account ${account.email}:`, error);
    }
  }

  await orm.em.flush();
  console.log('Migration complete!');
};

(async () => {
  try {
    await orm.migrator.up();
    await RequestContext.create(orm.em, backfill);
  } finally {
    await orm?.close(true);
  }
})();
