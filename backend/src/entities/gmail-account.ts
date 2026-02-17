import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { User } from '@/entities/user';
import { Encryption } from '@/utils/encryption';

const ACCESS_TOKEN_EXPIRATION_MS = (3_600 - 5) * 1_000; // 1 hour - 5 seconds buffer

@Entity({ tableName: 'gmail_accounts' })
@Unique({ properties: ['googleId'] })
@Index({ properties: ['user'] })
export class GmailAccount extends BaseEntity {
  @ManyToOne()
  board?: Board;
  @ManyToOne()
  user: User;

  @Property()
  googleId: string;
  @Property({ columnType: 'text' })
  accessTokenEncrypted: string;
  @Property()
  accessTokenExpiresAt: Date;
  @Property({ columnType: 'text' })
  refreshTokenEncrypted: string;

  constructor({
    user,
    googleId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }: {
    user: User;
    googleId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt?: Date;
  }) {
    super();
    this.user = user;
    this.googleId = googleId;
    this.accessTokenEncrypted = Encryption.encrypt(accessToken);
    this.accessTokenExpiresAt = accessTokenExpiresAt || new Date(Date.now() + ACCESS_TOKEN_EXPIRATION_MS);
    this.refreshTokenEncrypted = Encryption.encrypt(refreshToken);
    this.validate();
  }

  private validate() {
    if (!this.user) throw new Error('User is required');
    if (!this.googleId) throw new Error('Google ID is required');
    if (!this.accessTokenEncrypted) throw new Error('Access token is required');
    if (!this.accessTokenExpiresAt) throw new Error('Access token expiration date is required');
    if (!this.refreshTokenEncrypted) throw new Error('Refresh token is required');
  }
}
