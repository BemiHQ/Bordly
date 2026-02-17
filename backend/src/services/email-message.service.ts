import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';

import { Attachment } from '@/entities/attachment';
import { EmailMessage } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { GmailAccountService } from '@/services/gmail-account.service';
import { gmailAttachmentsData, gmailBody, gmailHeaderValue, newGmail } from '@/utils/google-api';
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
      const messageDetails = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });

      const { emailMessage, attachments } = EmailMessageService.parseEmailMessage({
        gmailAccount,
        messageData: messageDetails.data,
      });
      emailsMessagesToCreate.push(emailMessage);
      attachmentsToCreate.push(...attachments);
    }

    await orm.em.persist([...emailsMessagesToCreate, ...attachmentsToCreate]).flush();
  }

  private static parseEmailMessage({
    gmailAccount,
    messageData,
  }: {
    gmailAccount: GmailAccount;
    messageData: gmail_v1.Schema$Message;
  }) {
    const headers = messageData.payload?.headers || [];

    const to = gmailHeaderValue(headers, 'to')
      ?.split(',')
      .map((e) => e.trim());
    const cc = gmailHeaderValue(headers, 'cc')
      ?.split(',')
      .map((e) => e.trim());
    const bcc = gmailHeaderValue(headers, 'bcc')
      ?.split(',')
      .map((e) => e.trim());
    const { bodyText, bodyHtml } = gmailBody(messageData.payload);

    const emailMessage = new EmailMessage({
      gmailAccount,
      externalId: messageData.id as string,
      externalThreadId: messageData.threadId as string,
      externalCreatedAt: new Date(parseInt(messageData.internalDate as string, 10)),
      from: gmailHeaderValue(headers, 'from') as string,
      subject: gmailHeaderValue(headers, 'subject') as string,
      snippet: messageData.snippet as string,
      labels: messageData.labelIds as string[],
      to,
      replyTo: gmailHeaderValue(headers, 'reply-to'),
      cc,
      bcc,
      bodyText,
      bodyHtml,
    });

    const attachments: Attachment[] = [];

    for (const attachmentData of gmailAttachmentsData(messageData.payload)) {
      const attachment = new Attachment({
        gmailAccount,
        emailMessage,
        externalId: attachmentData.externalId,
        filename: attachmentData.filename,
        mimeType: attachmentData.mimeType,
        size: attachmentData.size,
      });
      attachments.push(attachment);
    }

    return { emailMessage, attachments };
  }
}
