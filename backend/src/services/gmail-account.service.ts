import type { Populate } from '@mikro-orm/postgresql';
import type { Auth } from 'googleapis';
import { Attachment } from '@/entities/attachment';
import { Board } from '@/entities/board';
import { BoardCard } from '@/entities/board-card';
import { BoardColumn } from '@/entities/board-column';
import { BoardInvite } from '@/entities/board-invite';
import { BoardMember, Role } from '@/entities/board-member';
import { EmailMessage } from '@/entities/email-message';
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

  static findAllAccountsWithBoards<Hint extends string = never>(
    { populate }: { populate?: Populate<GmailAccount, Hint> } = { populate: [] },
  ) {
    return orm.em.find(GmailAccount, { board: { $ne: null } }, { populate });
  }

  static async addToBoard(gmailAccount: GmailAccount, { board }: { board: Board }) {
    gmailAccount.addToBoard(board);
    const boardMember = new BoardMember({ board, user: gmailAccount.user, role: Role.MEMBER });

    await orm.em.persist([gmailAccount, boardMember]).flush();
  }

  static async deleteFromBoard(gmailAccountId: string, { board }: { board: Board }) {
    const gmailAccount = await GmailAccountService.findById(gmailAccountId, { populate: ['user.boardMembers'] });
    if (gmailAccount.board!.id !== board.id) {
      throw new Error('Gmail account does not belong to the specified board');
    }
    const boardMember = gmailAccount.user.boardMembers.find((bm) => bm.board.id === board.id);
    if (!boardMember) {
      throw new Error('Board member not found for the specified board');
    }

    const gmailAccountCount = await orm.em.count(GmailAccount, { board });

    await orm.em.transactional(async (em) => {
      await em.nativeDelete(Attachment, { gmailAccount: gmailAccount.id });
      await em.nativeDelete(EmailMessage, { gmailAccount: gmailAccount.id });
      await em.nativeDelete(BoardCard, { gmailAccount: gmailAccount.id });
      await em.nativeDelete(BoardMember, { id: boardMember.id });

      gmailAccount.deleteFromBoard();
      await orm.em.persist(gmailAccount).flush();

      if (gmailAccountCount === 1) {
        await em.nativeDelete(BoardMember, { board: board.id });
        await em.nativeDelete(BoardColumn, { board: board.id });
        await em.nativeDelete(BoardInvite, { board: board.id });
        await em.nativeDelete(Board, { id: board.id });
      }
    });
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
