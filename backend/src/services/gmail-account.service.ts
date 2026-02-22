import type { Populate } from '@mikro-orm/postgresql';
import type { Auth } from 'googleapis';
import { Board } from '@/entities/board';
import { BoardAccount } from '@/entities/board-account';
import { BoardCard } from '@/entities/board-card';
import { BoardCardReadPosition } from '@/entities/board-card-read-position';
import { BoardColumn } from '@/entities/board-column';
import { BoardInvite } from '@/entities/board-invite';
import { BoardMember } from '@/entities/board-member';
import { Comment } from '@/entities/comment';
import { EmailDraft } from '@/entities/email-draft';
import { EmailMessage } from '@/entities/email-message';
import { FileAttachment } from '@/entities/file-attachment';
import { GmailAccount } from '@/entities/gmail-account';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { BoardCardService } from '@/services/board-card.service';
import { EmailDraftService } from '@/services/email-draft.service';
import { reportError } from '@/utils/error-tracking';
import { GmailApi } from '@/utils/gmail-api';
import { GoogleApi } from '@/utils/google-api';
import { orm } from '@/utils/orm';
import { S3Client } from '@/utils/s3-client';
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

  static async deleteFromBoard(board: Board, { gmailAccountId }: { gmailAccountId: string }) {
    const gmailAccount = await GmailAccountService.findById(gmailAccountId, {
      populate: ['boardAccounts', 'user.boardMembers'],
    });
    if ([...gmailAccount.boardAccounts].every((ba) => ba.board.id !== board.id)) {
      throw new Error('Gmail account does not belong to the specified board');
    }

    const gmailAccountCount = await orm.em.count(GmailAccount, { boardAccounts: { board } });

    const emailDrafts = await EmailDraftService.findDraftsByBoardAndGmailAccount({
      board,
      gmailAccount,
      populate: ['fileAttachments'],
    });
    const s3KeysToDelete = emailDrafts.flatMap((d) => d.fileAttachments.map((a) => a.s3Key));
    const boardCards = await BoardCardService.findByBoardAndGmailAccount({ board, gmailAccount });

    await orm.em.transactional(async (em) => {
      const emailMessagesCondition = {
        externalThreadId: { $in: boardCards.map((c) => c.externalThreadId).filter((id): id is string => !!id) },
      };
      await em.nativeDelete(GmailAttachment, { emailMessage: emailMessagesCondition });
      await em.nativeDelete(EmailMessage, emailMessagesCondition);

      const emailDraftsCondition = { id: { $in: emailDrafts.map((d) => d.id) } };
      await em.nativeDelete(FileAttachment, { emailDraft: emailDraftsCondition });
      await em.nativeDelete(EmailDraft, emailDraftsCondition);

      const boardCardsCondition = { id: { $in: boardCards.map((c) => c.id) } };
      await em.nativeDelete(Comment, { boardCard: boardCardsCondition });
      await em.nativeDelete(BoardCardReadPosition, { boardCard: boardCardsCondition });
      await em.nativeDelete(BoardCard, boardCardsCondition);

      await em.nativeDelete(BoardAccount, { gmailAccount: gmailAccount.id, board });

      await orm.em.persist(gmailAccount).flush();

      if (gmailAccountCount === 1) {
        // Delete records associated with member's gmail accounts (initiated by them vs shared gmail accounts)
        const boardCondition = { id: board.id };
        const boardCardCondition = { boardColumn: { board: boardCondition } };
        const membersBoardCards = await BoardCardService.findByBoard({ board });
        const membersEmailMessagesCondition = {
          externalThreadId: {
            $in: membersBoardCards.map((c) => c.externalThreadId).filter((id): id is string => !!id),
          },
        };
        await em.nativeDelete(GmailAttachment, { emailMessage: membersEmailMessagesCondition });
        await em.nativeDelete(EmailMessage, membersEmailMessagesCondition);
        await em.nativeDelete(FileAttachment, { emailDraft: { boardCard: boardCardCondition } });
        await em.nativeDelete(EmailDraft, { boardCard: boardCardCondition });
        await em.nativeDelete(Comment, { boardCard: boardCardCondition });
        await em.nativeDelete(BoardCardReadPosition, { boardCard: boardCardCondition });
        await em.nativeDelete(BoardCard, boardCardCondition);

        await em.nativeDelete(BoardMember, { board: boardCondition });
        await em.nativeDelete(BoardColumn, { board: boardCondition });
        await em.nativeDelete(BoardInvite, { board: boardCondition });
        await em.nativeDelete(Board, boardCondition);
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
