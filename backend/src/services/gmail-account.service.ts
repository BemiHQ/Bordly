import type { Populate } from '@mikro-orm/postgresql';
import type { Auth } from 'googleapis';
import { Board } from '@/entities/board';
import { BoardCard } from '@/entities/board-card';
import { BoardColumn } from '@/entities/board-column';
import { BoardInvite } from '@/entities/board-invite';
import { BoardMember } from '@/entities/board-member';
import { EmailDraft } from '@/entities/email-draft';
import { EmailMessage } from '@/entities/email-message';
import { FileAttachment } from '@/entities/file-attachment';
import { GmailAccount } from '@/entities/gmail-account';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { GmailApi } from '@/utils/gmail-api';
import { GoogleApi } from '@/utils/google-api';
import { orm } from '@/utils/orm';
import { S3Client } from '@/utils/s3-client';

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

  static findAllAccountsWithBoards<Hint extends string = never>(
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    return orm.em.find(GmailAccount, { board: { $ne: null } }, { populate });
  }

  static async addToBoard(gmailAccount: GmailAccount, { board }: { board: Board }) {
    gmailAccount.addToBoard(board);
    await orm.em.persist(gmailAccount).flush();
  }

  static async deleteFromBoard(board: Board, { gmailAccountId }: { gmailAccountId: string }) {
    const gmailAccount = await GmailAccountService.findById(gmailAccountId, { populate: ['user.boardMembers'] });
    if (gmailAccount.board!.id !== board.id) {
      throw new Error('Gmail account does not belong to the specified board');
    }

    const gmailAccountCount = await orm.em.count(GmailAccount, { board });

    const emailDrafts = await orm.em.find(
      EmailDraft,
      { boardCard: { gmailAccount } },
      { populate: ['fileAttachments'] },
    );
    const fileAttachmentIds = emailDrafts.flatMap((d) => d.fileAttachments.map((a) => a.id));
    const s3KeysToDelete = emailDrafts.flatMap((d) => d.fileAttachments.map((a) => a.s3Key));

    await orm.em.transactional(async (em) => {
      await em.nativeDelete(GmailAttachment, { gmailAccount: gmailAccount.id });
      await em.nativeDelete(EmailMessage, { gmailAccount: gmailAccount.id });
      await em.nativeDelete(FileAttachment, { id: { $in: fileAttachmentIds } });
      await em.nativeDelete(BoardCard, { gmailAccount: gmailAccount.id });

      gmailAccount.deleteFromBoard();
      await orm.em.persist(gmailAccount).flush();

      if (gmailAccountCount === 1) {
        await em.nativeDelete(BoardMember, { board: board.id });
        await em.nativeDelete(BoardColumn, { board: board.id });
        await em.nativeDelete(BoardInvite, { board: board.id });
        await em.nativeDelete(Board, { id: board.id });
      }

      await S3Client.deleteFiles({ keys: s3KeysToDelete });
    });
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
  }
}
