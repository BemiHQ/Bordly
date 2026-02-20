import * as cheerio from 'cheerio';
import { type Auth, google } from 'googleapis';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';

export const LABEL = {
  SPAM: 'SPAM',
  TRASH: 'TRASH',
  SENT: 'SENT',
  UNREAD: 'UNREAD',
  DRAFT: 'DRAFT',
};

export const VERIFICATION_STATUS_ACCEPTED = 'accepted';

export class GmailApi {
  static newGmail(oauth2Client: Auth.OAuth2Client) {
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  static async hasGmailAccess(oauth2Client: Auth.OAuth2Client, accessToken: string) {
    const tokenInfoResponse = await oauth2Client.getTokenInfo(accessToken);
    return tokenInfoResponse.scopes.includes('https://www.googleapis.com/auth/gmail.modify');
  }

  static headerValue(headers: gmail_v1.Schema$MessagePartHeader[], name: string) {
    return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || undefined;
  }

  static emailBody(payload?: gmail_v1.Schema$MessagePart) {
    if (!payload) return { bodyText: undefined, bodyHtml: undefined };

    const textParts: string[] = [];
    const htmlParts: string[] = [];

    if (payload.body?.data) {
      if (payload.mimeType === 'text/plain') {
        textParts.push(Buffer.from(payload.body.data, 'base64').toString('utf-8'));
      } else if (payload.mimeType === 'text/html') {
        htmlParts.push(Buffer.from(payload.body.data, 'base64').toString('utf-8'));
      }
    }

    if (payload.parts) {
      const extractBody = (parts: gmail_v1.Schema$MessagePart[]): void => {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            textParts.push(Buffer.from(part.body.data, 'base64').toString('utf-8'));
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            htmlParts.push(Buffer.from(part.body.data, 'base64').toString('utf-8'));
          } else if (part.mimeType?.startsWith('multipart/') && part.parts) {
            extractBody(part.parts);
          }
        }
      };
      extractBody(payload.parts);
    }

    const bodyText = textParts.length > 0 ? textParts.join('\n\n') : undefined;
    const bodyHtml = htmlParts.length > 0 ? htmlParts.join('\n') : undefined;

    if (bodyHtml && !bodyText) {
      const $ = cheerio.load(bodyHtml);
      return { bodyText: $.text(), bodyHtml };
    }

    return { bodyText, bodyHtml };
  }

  static attachmentsData(payload?: gmail_v1.Schema$MessagePart) {
    if (!payload || !payload.parts) return [];

    const attachments: { externalId: string; filename: string; mimeType: string; size: number; contentId?: string }[] =
      [];

    const extractAttachments = (parts: gmail_v1.Schema$MessagePart[]): void => {
      for (const part of parts) {
        if (part.filename && part.mimeType && part.body) {
          const contentIdHeader = GmailApi.headerValue(part.headers || [], 'Content-ID');
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

  static async markThreadAsRead(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { removeLabelIds: [LABEL.UNREAD] } });
  }

  static async markThreadAsUnread(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { addLabelIds: [LABEL.UNREAD] } });
  }

  static async markThreadAsTrash(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { addLabelIds: [LABEL.TRASH] } });
  }

  static async markThreadAsSpam(gmail: gmail_v1.Gmail, threadId: string) {
    await gmail.users.threads.modify({ userId: 'me', id: threadId, requestBody: { addLabelIds: [LABEL.SPAM] } });
  }

  static async listMessages(gmail: gmail_v1.Gmail, { limit, emails }: { limit: number; emails?: string[] }) {
    let q: string | undefined;
    if (emails && emails.length > 0) {
      q = emails.map((email) => `(from:${email} OR to:${email})`).join(' OR ');
    }
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: limit,
      includeSpamTrash: false,
      q,
    });
    return listResponse.data.messages || [];
  }

  static async getMessage(gmail: gmail_v1.Gmail, messageId: string) {
    const getResponse = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
    return getResponse.data;
  }

  static async getThread(gmail: gmail_v1.Gmail, threadId: string) {
    const getResponse = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    return getResponse.data;
  }

  static async listHistory(
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

  static async getAttachment(
    gmail: gmail_v1.Gmail,
    { messageId, externalAttachmentId }: { messageId: string; externalAttachmentId: string },
  ) {
    const response = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: externalAttachmentId });
    return response.data;
  }

  static async listSendAs(gmail: gmail_v1.Gmail) {
    const response = await gmail.users.settings.sendAs.list({ userId: 'me' });
    return response.data.sendAs || [];
  }

  static async sendEmail(
    gmail: gmail_v1.Gmail,
    {
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
      threadId,
      inReplyTo,
      references,
      attachments,
    }: {
      from: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
      threadId?: string;
      inReplyTo?: string;
      references?: string;
      attachments?: Array<{ filename: string; mimeType: string; data: Buffer }>;
    },
  ) {
    const boundary = `boundary_${Date.now()}`;
    const headers = [
      `From: ${GmailApi.sanitize(from)}`,
      to && to.length > 0 ? `To: ${to.map(GmailApi.sanitize).join(', ')}` : undefined,
      cc && cc.length > 0 ? `Cc: ${cc.map(GmailApi.sanitize).join(', ')}` : undefined,
      bcc && bcc.length > 0 ? `Bcc: ${bcc.map(GmailApi.sanitize).join(', ')}` : undefined,
      `Subject: ${GmailApi.encodeHeaderValue(GmailApi.sanitize(subject || ''))}`,
      inReplyTo ? `In-Reply-To: ${GmailApi.sanitize(inReplyTo)}` : undefined,
      references ? `References: ${GmailApi.sanitize(references)}` : undefined,
      'MIME-Version: 1.0',
      attachments && attachments.length > 0
        ? `Content-Type: multipart/mixed; boundary="${boundary}"`
        : 'Content-Type: text/html; charset=utf-8',
    ]
      .filter(Boolean)
      .join('\r\n');

    let message = `${headers}\r\n\r\n`;

    if (attachments && attachments.length > 0) {
      // Add body part
      message += `--${boundary}\r\n`;
      message += 'Content-Type: text/html; charset=utf-8\r\n\r\n';
      message += bodyHtml || '';
      message += '\r\n';

      // Add attachment parts
      for (const attachment of attachments) {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${GmailApi.sanitize(attachment.mimeType)}\r\n`;
        message += 'Content-Transfer-Encoding: base64\r\n';
        message += `Content-Disposition: attachment; filename="${GmailApi.encodeHeaderValue(GmailApi.sanitizeFileName(attachment.filename))}"\r\n\r\n`;
        message += `${attachment.data.toString('base64')}\r\n`;
      }

      message += `--${boundary}--`;
    } else {
      message += bodyHtml || '';
    }

    const encodedMessage = Buffer.from(message, 'utf-8')
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

  private static sanitize(value: string) {
    return value.replace(/[\r\n]/g, ''); // Remove CRLF to prevent header injection attacks
  }

  private static sanitizeFileName(filename: string) {
    return GmailApi.sanitize(filename).replace(/["\\]/g, '').replace(/[/\\]/g, '_'); // Remove quotes and backslashes, replace path separators with underscores
  }

  private static encodeHeaderValue(value: string) {
    // Check if value contains only printable ASCII characters (space through tilde)
    if (/^[\x20-\x7E]*$/.test(value)) {
      return value;
    }
    return `=?utf-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=`;
  }
}
