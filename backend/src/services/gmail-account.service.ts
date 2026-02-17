import type { Populate } from '@mikro-orm/postgresql';

import { GmailAccount } from '@/entities/gmail-account';
import { orm } from '@/utils/orm';

export class GmailAccountService {
  static tryFindByGoogleId(
    googleId?: string | null,
    { populate }: { populate?: Populate<GmailAccount, 'string'> } = { populate: [] },
  ) {
    if (!googleId) return null;
    return orm.em.findOne(GmailAccount, { googleId }, { populate });
  }

  static findById(id: string) {
    return orm.em.findOneOrFail(GmailAccount, { id });
  }
}
