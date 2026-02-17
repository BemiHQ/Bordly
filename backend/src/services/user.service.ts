import type { Populate } from '@mikro-orm/postgresql';
import { State as BoardInviteState } from '@/entities/board-invite';
import { BoardMember } from '@/entities/board-member';
import { GmailAccount } from '@/entities/gmail-account';
import { User } from '@/entities/user';
import { BoardInviteService } from '@/services/board-invite.service';
import { orm } from '@/utils/orm';

export class UserService {
  static tryFindById(id: string, { populate }: { populate?: Populate<User, 'string'> } = { populate: [] }) {
    if (!id) return null;
    return orm.em.findOne(User, { id }, { populate });
  }

  static async createWithGmailAccount({
    email,
    name,
    photoUrl,
    googleId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }: {
    email: string;
    name: string;
    photoUrl: string;
    googleId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt?: Date;
  }) {
    const user = new User({ email, name, photoUrl });
    const gmailAccount = new GmailAccount({ user, email, googleId, accessToken, refreshToken, accessTokenExpiresAt });
    orm.em.persist([user, gmailAccount]);

    // Automatically accept any pending board invites
    const boardInvites = await BoardInviteService.findPendingInvites(email, { populate: ['board'] });
    if (boardInvites && boardInvites.length > 0) {
      for (const boardInvite of boardInvites) {
        const boardMember = new BoardMember({ board: boardInvite.board, user });
        boardInvite.state = BoardInviteState.ACCEPTED;
        orm.em.persist([boardMember, boardInvite]);
      }
    }

    await orm.em.flush();
    return user;
  }

  static async updateLastSessionAt(user: User) {
    user.lastSessionAt = new Date();
    await orm.em.persist(user).flush();
  }
}
