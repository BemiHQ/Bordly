import type { Board } from '@/entities/board';
import { EmailAddress } from '@/entities/email-address';
import { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi, VERIFICATION_STATUS_ACCEPTED } from '@/utils/gmail-api';
import { mapBy } from '@/utils/lists';
import { orm } from '@/utils/orm';

export class EmailAddressService {
  static async createAddresses(gmailAccount: GmailAccount) {
    const gmail = await GmailAccountService.initGmail(gmailAccount);
    const sendAsItems = await GmailApi.listSendAs(gmail);

    const emailAddresses: EmailAddress[] = [];
    for (const sendAs of sendAsItems) {
      if (!sendAs.sendAsEmail || (!sendAs.isPrimary && sendAs.verificationStatus !== VERIFICATION_STATUS_ACCEPTED)) {
        continue;
      }

      const emailAddress = new EmailAddress({
        gmailAccount,
        isPrimary: sendAs.isPrimary || false,
        isDefault: sendAs.isDefault || false,
        email: sendAs.sendAsEmail,
        name: sendAs.displayName || undefined,
        replyTo: sendAs.replyToAddress || undefined,
      });
      emailAddresses.push(emailAddress);
    }

    orm.em.persist(emailAddresses);
    await orm.em.flush();

    return emailAddresses;
  }

  static async findEmailAddresses(user: User, board: Board) {
    return orm.em.find(EmailAddress, { gmailAccount: { $or: [{ user }, { board }] } });
  }

  static async syncEmailAddresses() {
    const gmailAccounts = await orm.em.find(GmailAccount, {}, { populate: ['emailAddresses'] });

    for (const gmailAccount of gmailAccounts) {
      const gmail = await GmailAccountService.initGmail(gmailAccount);
      const sendAsItems = await GmailApi.listSendAs(gmail);

      const emailAddressByEmail = mapBy([...gmailAccount.emailAddresses], (addr) => addr.email);

      for (const sendAs of sendAsItems) {
        if (!sendAs.sendAsEmail) continue;

        const emailAddress = emailAddressByEmail[sendAs.sendAsEmail];

        if (!sendAs.isPrimary && sendAs.verificationStatus !== VERIFICATION_STATUS_ACCEPTED) {
          // Not verified -> remove
          if (emailAddress) orm.em.remove(emailAddress);
          continue;
        }

        if (emailAddress) {
          // Existing address -> update
          emailAddress.update({
            isPrimary: sendAs.isPrimary || false,
            isDefault: sendAs.isDefault || false,
            name: sendAs.displayName || undefined,
            replyTo: sendAs.replyToAddress || undefined,
          });
          orm.em.persist(emailAddress);
        } else {
          // New address -> create
          const newEmailAddress = new EmailAddress({
            gmailAccount,
            isPrimary: sendAs.isPrimary || false,
            isDefault: sendAs.isDefault || false,
            email: sendAs.sendAsEmail,
            name: sendAs.displayName || undefined,
            replyTo: sendAs.replyToAddress || undefined,
          });
          orm.em.persist(newEmailAddress);
        }
      }

      await orm.em.flush();
    }
  }
}
