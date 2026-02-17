import { Attachment } from '@/entities/attachment';
import { EmailMessage } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { GmailAccountService } from '@/services/gmail-account.service';
import { gmailAttachments, gmailBody, gmailHeaderValue, newGmail } from '@/utils/google-api';
import { orm } from '@/utils/orm';

const CREATE_INITIAL_EMAILS_LIMIT = 50;

export class EmailMessageService {
  static async createInitialEmailMessages({ gmailAccount: gmailAcc }: { gmailAccount: GmailAccount }) {
    const { gmailAccount, oauth2Client } = await GmailAccountService.refreshAccessToken(gmailAcc);
    const gmail = newGmail(oauth2Client);

    console.log(`[GMAIL] Fetching ${gmailAccount.email} initial emails...`);
    const listResponse = await gmail.users.messages.list({ userId: 'me', maxResults: CREATE_INITIAL_EMAILS_LIMIT }); // in desc order
    const messages = listResponse.data.messages || [];
    if (messages.length === 0) return;

    const emailsMessagesToCreate: EmailMessage[] = [];
    const attachmentsToCreate: Attachment[] = [];

    for (const message of messages) {
      if (!message.id) continue;

      console.log(`[GMAIL] Fetching ${gmailAccount.email} email ${message.id}...`);
      const messageData = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
      const payload = messageData.data.payload;
      const headers = payload?.headers || [];

      const to = gmailHeaderValue(headers, 'to')
        ?.split(',')
        .map((e) => e.trim());
      const cc = gmailHeaderValue(headers, 'cc')
        ?.split(',')
        .map((e) => e.trim());
      const bcc = gmailHeaderValue(headers, 'bcc')
        ?.split(',')
        .map((e) => e.trim());
      const { bodyText, bodyHtml } = gmailBody(payload);

      const emailMessage = new EmailMessage({
        gmailAccount,
        externalId: messageData.data.id as string,
        externalThreadId: messageData.data.threadId as string,
        externalCreatedAt: new Date(parseInt(messageData.data.internalDate as string, 10)),
        from: gmailHeaderValue(headers, 'from') as string,
        subject: gmailHeaderValue(headers, 'subject') as string,
        snippet: messageData.data.snippet as string,
        labels: messageData.data.labelIds as string[],
        to,
        replyTo: gmailHeaderValue(headers, 'reply-to'),
        cc,
        bcc,
        bodyText,
        bodyHtml,
      });

      emailsMessagesToCreate.push(emailMessage);

      const attachments = gmailAttachments(payload);
      for (const att of attachments) {
        const attachment = new Attachment({
          gmailAccount,
          emailMessage,
          externalId: att.externalId,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
        });
        attachmentsToCreate.push(attachment);
      }
    }

    await orm.em.persist([...emailsMessagesToCreate, ...attachmentsToCreate]).flush();
  }
}
