import * as cheerio from 'cheerio';
import { type Auth, google } from 'googleapis';
import type { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';

import { ENV } from '@/utils/env';

export const newOauth2Client = (credentials?: {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}) => {
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
};

export const newOauth2 = (oauth2Client: Auth.OAuth2Client) => {
  return google.oauth2({ version: 'v2', auth: oauth2Client });
};

export const newGmail = (oauth2Client: Auth.OAuth2Client) => {
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

export const gmailHeaderValue = (headers: gmail_v1.Schema$MessagePartHeader[], name: string) =>
  headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || undefined;

export const gmailBody = (payload?: gmail_v1.Schema$MessagePart) => {
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
};

export const gmailAttachmentsData = (payload?: gmail_v1.Schema$MessagePart) => {
  if (!payload || !payload.parts) return [];

  const attachments: { externalId: string; filename: string; mimeType: string; size: number }[] = [];

  const extractAttachments = (parts: gmail_v1.Schema$MessagePart[]): void => {
    for (const part of parts) {
      if (part.filename && part.mimeType && part.body) {
        attachments.push({
          externalId: part.body.attachmentId as string,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size as number,
        });
      }
      if (part.parts) {
        extractAttachments(part.parts);
      }
    }
  };

  extractAttachments(payload.parts);

  return attachments;
};
