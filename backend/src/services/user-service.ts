import { User } from '../entities/user';
import { orm } from '../utils/orm';

export const findUserByGoogleId = (googleId?: string | null) => {
  if (!googleId) return null;
  return orm.em.findOne(User, { googleId });
};

export const createUser = async ({
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
}) => {
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
};

export const updateLastSessionAt = async (user: User) => {
  user.lastSessionAt = new Date();
  await orm.em.persist(user).flush();
};
