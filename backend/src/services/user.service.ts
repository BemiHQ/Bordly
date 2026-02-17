import { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class UserService {
  static findUserByGoogleId(googleId?: string | null) {
    if (!googleId) return null;
    return orm.em.findOne(User, { googleId });
  }

  static findUserById(id: string) {
    if (!id) return null;
    return orm.em.findOne(User, { id });
  }

  static async createUser({
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
    const user = new User({
      email,
      name,
      photoUrl,
      googleId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
    });
    await orm.em.persist(user).flush();
    return user;
  }

  static async updateLastSessionAt(user: User) {
    user.lastSessionAt = new Date();
    await orm.em.persist(user).flush();
  }
}
