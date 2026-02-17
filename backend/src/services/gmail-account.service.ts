import type { Populate } from '@mikro-orm/postgresql';
import type { Auth } from 'googleapis';

import { GmailAccount } from '@/entities/gmail-account';
import { newOauth2Client } from '@/utils/google-api';
import { orm } from '@/utils/orm';

export class GmailAccountService {
  static tryFindByGoogleId<Hint extends string = never>(
    googleId?: string | null,
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    if (!googleId) return null;
    return orm.em.findOne(GmailAccount, { googleId }, { populate });
  }

  static findById<Hint extends string = never>(
    id: string,
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    return orm.em.findOneOrFail(GmailAccount, { id }, { populate });
  }

  static findAllAccounts<Hint extends string = never>(
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    return orm.em.find(GmailAccount, {}, { populate });
  }

  static async refreshAccessToken(
    gmailAccount: GmailAccount,
  ): Promise<{ gmailAccount: GmailAccount; oauth2Client: Auth.OAuth2Client }> {
    const oauth2Client = newOauth2Client({
      accessToken: gmailAccount.accessToken,
      accessTokenExpiresAt: gmailAccount.accessTokenExpiresAt,
      refreshToken: gmailAccount.refreshToken,
    });

    if (!gmailAccount.isAccessTokenExpired()) {
      return { gmailAccount, oauth2Client };
    }

    const { credentials } = await oauth2Client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    gmailAccount.updateAccessToken(credentials.access_token, new Date(credentials.expiry_date as number));
    await orm.em.persist(gmailAccount).flush();

    return { gmailAccount, oauth2Client };
  }
}
