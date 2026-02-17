import * as cheerio from 'cheerio';
import { type Auth, google } from 'googleapis';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';

import { ENV } from '@/utils/env';

export const LABEL = {
  SPAM: 'SPAM',
  TRASH: 'TRASH',
  SENT: 'SENT',
  UNREAD: 'UNREAD',
  DRAFT: 'DRAFT',
};

export const MAX_SNIPPET_LENGTH = 190;

export class GoogleApi {
  static newOauth2Client(credentials?: { accessToken: string; accessTokenExpiresAt: Date; refreshToken: string }) {
    const oauth2Client: Auth.OAuth2Client = new google.auth.OAuth2(
      ENV.GOOGLE_OAUTH_CLIENT_ID,
      ENV.GOOGLE_OAUTH_CLIENT_SECRET,
      ENV.GOOGLE_OAUTH_CALLBACK_URL,
    );

    if (credentials) {
      oauth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken,
        expiry_date: credentials.accessTokenExpiresAt.getTime(),
      });
    }

    return oauth2Client;
  }

  static newOauth2(oauth2Client: Auth.OAuth2Client) {
    return google.oauth2({ version: 'v2', auth: oauth2Client });
  }

  static async hasGmailAccess(oauth2Client: Auth.OAuth2Client, accessToken: string) {
    const tokenInfoResponse = await oauth2Client.getTokenInfo(accessToken);
    return tokenInfoResponse.scopes.includes('https://www.googleapis.com/auth/gmail.modify');
  }

  static newGmail(oauth2Client: Auth.OAuth2Client) {
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  static gmailHeaderValue(headers: gmail_v1.Schema$MessagePartHeader[], name: string) {
    return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || undefined;
  }

  static gmailBody(payload?: gmail_v1.Schema$MessagePart) {
    if (!payload) return { bodyText: undefined, bodyHtml: undefined };

    let bodyText: string | undefined;
    let bodyHtml: string | undefined;

    if (payload.body?.data) {
      if (payload.mimeType === 'text/plain') {
        bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload.mimeType === 'text/html') {
        bodyHtml = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }
    }

    if (payload.parts) {
      const extractBody = (parts: gmail_v1.Schema$MessagePart[]): void => {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.parts) {
            extractBody(part.parts);
          }
        }
      };
      extractBody(payload.parts);
    }

    if (bodyHtml && !bodyText) {
      const $ = cheerio.load(bodyHtml);
      bodyText = $.text();
    }

    return { bodyText, bodyHtml };
  }

  static gmailAttachmentsData(payload?: gmail_v1.Schema$MessagePart) {
    if (!payload || !payload.parts) return [];

    const attachments: { externalId: string; filename: string; mimeType: string; size: number; contentId?: string }[] =
      [];

    const extractAttachments = (parts: gmail_v1.Schema$MessagePart[]): void => {
      for (const part of parts) {
        if (part.filename && part.mimeType && part.body) {
          const contentIdHeader = GoogleApi.gmailHeaderValue(part.headers || [], 'Content-ID');
          const contentId = contentIdHeader ? contentIdHeader.replace(/^<|>$/g, '') : undefined;

          attachments.push({
            externalId: part.body.attachmentId as string,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size as number,
            contentId,
          });
        }
        if (part.parts) {
          extractAttachments(part.parts);
        }
      }
    };

    extractAttachments(payload.parts);

    return attachments;
  }

  static async gmailMarkThreadAsRead(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { removeLabelIds: [LABEL.UNREAD] } });
  }

  static async gmailMarkThreadAsUnread(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { addLabelIds: [LABEL.UNREAD] } });
  }

  static async gmailMarkThreadAsTrash(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { addLabelIds: [LABEL.TRASH] } });
  }

  static async gmailMarkThreadAsSpam(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { addLabelIds: [LABEL.SPAM] } });
  }

  static async gmailListMessages(gmail: gmail_v1.Gmail, { limit }: { limit: number }) {
    const listResponse = await gmail.users.messages.list({ userId: 'me', maxResults: limit, includeSpamTrash: false });
    return listResponse.data.messages || [];
  }

  static async gmailGetMessage(gmail: gmail_v1.Gmail, messageId: string) {
    const getResponse = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    return getResponse.data;
  }

  static async gmailListHistory(
    gmail: gmail_v1.Gmail,
    { startHistoryId, pageToken }: { startHistoryId?: string; pageToken?: string },
  ) {
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
      pageToken,
    });
    return {
      historyItems: historyResponse.data.history || [],
      nextPageToken: historyResponse.data.nextPageToken || undefined,
      historyId: historyResponse.data.historyId || undefined,
    };
  }

  static async gmailGetAttachment(
    gmail: gmail_v1.Gmail,
    { messageId, attachmentId }: { messageId: string; attachmentId: string },
  ) {
    const response = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId });
    return response.data;
  }

  static async gmailListSendAs(gmail: gmail_v1.Gmail) {
    const response = await gmail.users.settings.sendAs.list({ userId: 'me' });
    return response.data.sendAs || [];
  }

  static async gmailSendEmail(
    gmail: gmail_v1.Gmail,
    {
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
      threadId,
    }: {
      from: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
      threadId?: string;
    },
  ) {
    const headers = [
      `From: ${from}`,
      to && to.length > 0 ? `To: ${to.join(', ')}` : undefined,
      cc && cc.length > 0 ? `Cc: ${cc.join(', ')}` : undefined,
      bcc && bcc.length > 0 ? `Bcc: ${bcc.join(', ')}` : undefined,
      `Subject: ${subject || ''}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
    ]
      .filter(Boolean)
      .join('\r\n');

    const message = `${headers}\r\n\r\n${bodyHtml || ''}`;
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId,
      },
    });

    return response.data;
  }
}
