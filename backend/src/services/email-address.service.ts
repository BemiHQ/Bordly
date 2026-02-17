import type { Board } from '@/entities/board';
import { EmailAddress } from '@/entities/email-address';
import type { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi } from '@/utils/gmail-api';
import { orm } from '@/utils/orm';

export class EmailAddressService {
  static async createAddresses(gmailAccount: GmailAccount) {
    const gmail = await GmailAccountService.initGmail(gmailAccount);
    const sendAsSettings = await GmailApi.listSendAs(gmail);

    const emailAddresses: EmailAddress[] = [];
    for (const sendAs of sendAsSettings) {
      if (!sendAs.sendAsEmail) continue;

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
}
