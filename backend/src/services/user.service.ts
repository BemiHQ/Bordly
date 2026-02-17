import type { Populate } from '@mikro-orm/postgresql';
import { GmailAccount } from '@/entities/gmail-account';
import { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class UserService {
  static findById(id: string, { populate }: { populate?: Populate<User, 'string'> } = { populate: [] }) {
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
    const gmailAccount = new GmailAccount({ user, googleId, accessToken, refreshToken, accessTokenExpiresAt });
    await orm.em.persist([user, gmailAccount]).flush();
    return user;
  }

  static async updateLastSessionAt(user: User) {
    user.lastSessionAt = new Date();
    await orm.em.persist(user).flush();
  }
}
