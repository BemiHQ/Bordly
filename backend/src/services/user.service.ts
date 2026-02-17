import type { Populate } from '@mikro-orm/postgresql';
import { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class UserService {
  static findByGoogleId(googleId?: string | null) {
    if (!googleId) return null;
    return orm.em.findOne(User, { googleId });
  }

  static findById(id: string, { populate }: { populate?: Populate<User, 'string'> } = { populate: [] }) {
    if (!id) return null;
    return orm.em.findOne(User, { id }, { populate });
  }

  static async create({
    email,
    name,
    photoUrl,
    googleId,
  }: {
    email: string;
    name: string;
    photoUrl: string;
    googleId: string;
  }) {
    const user = new User({ email, name, photoUrl, googleId });
    await orm.em.persist(user).flush();
    return user;
  }

  static async updateLastSessionAt(user: User) {
    user.lastSessionAt = new Date();
    await orm.em.persist(user).flush();
  }
}
