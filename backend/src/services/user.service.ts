import type { Populate } from '@mikro-orm/postgresql';
import { GmailAccount } from '@/entities/gmail-account';
import { BORDLY_USER_ID, User } from '@/entities/user';
import { BoardInviteService } from '@/services/board-invite.service';
import { EmailAddressService } from '@/services/email-address.service';
import { orm } from '@/utils/orm';

export class UserService {
  static tryFindById<Hint extends string = never>(
    id?: string,
    { populate }: { populate?: Populate<User, Hint> } = { populate: [] },
  ) {
    if (!id) return null;
    return orm.em.findOne(User, { id }, { populate });
  }

  static async bordlyUser() {
    return orm.em.findOneOrFail(User, { id: BORDLY_USER_ID });
  }

  static async createWithGmailAccount({
    email,
    name,
    photoUrl,
    externalId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }: {
    email: string;
    name: string;
    photoUrl: string;
    externalId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
  }) {
    const user = new User({ email, name, photoUrl });
    const gmailAccount = new GmailAccount({
      user,
      name,
      email,
      externalId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
    });
    orm.em.persist([user, gmailAccount]);

    await BoardInviteService.acceptPendingInvites({ email, user });
    await EmailAddressService.createAddresses(gmailAccount);
    await orm.em.flush();

    return { user, gmailAccount };
  }

  static async updateLastSessionAt(user: User) {
    user.touchLastSessionAt();
    await orm.em.persist(user).flush();
  }
}
