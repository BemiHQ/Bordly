import { type Auth, google } from 'googleapis';

import { ENV } from '@/utils/env';

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
}
