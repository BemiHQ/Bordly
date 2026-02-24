import type { Populate } from '@mikro-orm/postgresql';
import type { Auth } from 'googleapis';
import type { Board } from '@/entities/board';
import { BoardAccount } from '@/entities/board-account';
import { GmailAccount } from '@/entities/gmail-account';
import { reportError } from '@/utils/error-tracking';
import { GmailApi } from '@/utils/gmail-api';
import { GoogleApi } from '@/utils/google-api';
import { orm } from '@/utils/orm';
import { GmailAccountState } from '@/utils/shared';

export class GmailAccountService {
  static tryFindByExternalId<Hint extends string = never>(
    externalId?: string | null,
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    if (!externalId) return null;
    return orm.em.findOne(GmailAccount, { externalId }, { populate });
  }

  static findById<Hint extends string = never>(
    id: string,
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    return orm.em.findOneOrFail(GmailAccount, { id }, { populate });
  }

  static findActiveAccounts<Hint extends string = never>(
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    return orm.em.find(GmailAccount, { state: GmailAccountState.ACTIVE }, { populate });
  }

  static findActiveAccountsWithBoards<Hint extends string = never>(
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    return orm.em.find(GmailAccount, { boardAccounts: { $ne: null }, state: GmailAccountState.ACTIVE }, { populate });
  }

  static async addToBoard(gmailAccount: GmailAccount, { board }: { board: Board }) {
    const boardAccount = new BoardAccount({ board, gmailAccount });
    await orm.em.persist(boardAccount).flush();
  }

  static async initGmail(gmailAccount: GmailAccount) {
    const { oauth2Client } = await GmailAccountService.refreshAccessToken(gmailAccount);
    return GmailApi.newGmail(oauth2Client);
  }

  static async hasGmailAccess(gmailAccount: GmailAccount) {
    const { oauth2Client, accessToken } = await GmailAccountService.refreshAccessToken(gmailAccount);
    return GmailApi.hasGmailAccess(oauth2Client, accessToken);
  }

  static async setTokens(
    gmailAccount: GmailAccount,
    {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
    }: { accessToken: string; refreshToken: string; accessTokenExpiresAt: Date },
  ) {
    gmailAccount.setTokens({ accessToken, refreshToken, accessTokenExpiresAt });
    await orm.em.persist(gmailAccount).flush();
  }

  static async refreshAccessToken(
    gmailAccount: GmailAccount,
  ): Promise<{ gmailAccount: GmailAccount; oauth2Client: Auth.OAuth2Client; accessToken: string }> {
    try {
      const oauth2Client = GoogleApi.newOauth2Client({
        accessToken: gmailAccount.accessToken,
        accessTokenExpiresAt: gmailAccount.accessTokenExpiresAt,
        refreshToken: gmailAccount.refreshToken,
      });

      if (!gmailAccount.isAccessTokenExpired()) {
        return { gmailAccount, oauth2Client, accessToken: gmailAccount.accessToken };
      }

      const { credentials } = await oauth2Client.refreshAccessToken();
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      gmailAccount.setTokens({
        accessToken: credentials.access_token,
        refreshToken: gmailAccount.refreshToken,
        accessTokenExpiresAt: new Date(credentials.expiry_date as number),
      });
      await orm.em.persist(gmailAccount).flush();

      return { gmailAccount, oauth2Client, accessToken: credentials.access_token };
    } catch (error) {
      reportError(error, { email: gmailAccount.email });
      throw error;
    }
  }
}
