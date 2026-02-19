import type { Loaded, Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import type { Participant } from '@/entities/email-message';
import { GmailAccount } from '@/entities/gmail-account';
import { SenderEmailAddress } from '@/entities/sender-email-address';
import type { User } from '@/entities/user';
import { BoardAccountService } from '@/services/board-account.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi, VERIFICATION_STATUS_ACCEPTED } from '@/utils/gmail-api';
import { groupBy, mapBy } from '@/utils/lists';
import { orm } from '@/utils/orm';

export class SenderEmailAddressService {
  static toParticipant(emailAddress: SenderEmailAddress) {
    return { name: emailAddress.name, email: emailAddress.email } as Participant;
  }

  static async persistNewAddresses(gmailAccount: GmailAccount) {
    const gmail = await GmailAccountService.initGmail(gmailAccount);
    const sendAsItems = await GmailApi.listSendAs(gmail);

    const emailAddresses: SenderEmailAddress[] = [];
    for (const sendAs of sendAsItems) {
      if (!sendAs.sendAsEmail || (!sendAs.isPrimary && sendAs.verificationStatus !== VERIFICATION_STATUS_ACCEPTED)) {
        continue;
      }

      const emailAddress = new SenderEmailAddress({
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

    return emailAddresses;
  }

  static async findAddressesByBoard<Hint extends string = never>(
    board: Board,
    { user, populate = [] }: { user: User; populate?: Populate<SenderEmailAddress, Hint> },
  ) {
    const boardAccounts = await BoardAccountService.findAccountsByBoard(board, { populate: ['gmailAccount'] });
    const boardAccountsByGmailAccountId = groupBy(boardAccounts, (ba) => ba.gmailAccount.id);

    const senderEmailAddresses = await orm.em.find(
      SenderEmailAddress,
      { gmailAccount: { $or: [{ user }, { id: { $in: boardAccounts.map((ba) => ba.gmailAccount.id) } }] } },
      { populate },
    );

    return senderEmailAddresses.filter((emailAddress) => {
      // Current user's email addresses
      if (emailAddress.loadedGmailAccount.user.id === user.id) return true;

      // Board accounts' email addresses
      const boardAccounts = boardAccountsByGmailAccountId[emailAddress.gmailAccount.id]!;
      return boardAccounts.some((ba) => !ba.receivingEmails || ba.receivingEmails.includes(emailAddress.email));
    });
  }

  static async findAddressesByGmailAccount(gmailAccount: GmailAccount) {
    return orm.em.find(SenderEmailAddress, { gmailAccount });
  }

  static async syncEmailAddressesForGmailAccount(gmailAccount: Loaded<GmailAccount, 'senderEmailAddresses'>) {
    const gmail = await GmailAccountService.initGmail(gmailAccount);
    const sendAsItems = await GmailApi.listSendAs(gmail);

    const emailAddressByEmail = mapBy([...gmailAccount.senderEmailAddresses], (addr) => addr.email);

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
        const newEmailAddress = new SenderEmailAddress({
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

  static async syncEmailAddresses() {
    const gmailAccounts = await orm.em.find(GmailAccount, {}, { populate: ['senderEmailAddresses'] });

    for (const gmailAccount of gmailAccounts) {
      await SenderEmailAddressService.syncEmailAddressesForGmailAccount(gmailAccount);
    }
  }
}
