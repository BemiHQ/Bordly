import { Entity, Property, Unique } from '@mikro-orm/postgresql';
import { Encryption } from '../utils/encryption';
import { BaseEntity } from './base-entity';

const ACCESS_TOKEN_EXPIRATION_MS = (3_600 - 5) * 1_000; // 1 hour - 5 seconds buffer

@Entity({ tableName: 'users' })
@Unique({ properties: ['email'] })
@Unique({ properties: ['googleId'] })
export class User extends BaseEntity {
  @Property()
  email: string;
  @Property()
  name: string;
  @Property({ columnType: 'text' })
  photoUrl: string;
  @Property({ nullable: true })
  lastSessionAt: Date | null;

  // Google OAuth
  @Property()
  googleId: string;
  @Property({ columnType: 'text' })
  accessTokenEncrypted: string;
  @Property()
  accessTokenExpiresAt: Date;
  @Property({ columnType: 'text' })
  refreshTokenEncrypted: string;

  constructor({
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
    super();
    this.email = email;
    this.name = name;
    this.photoUrl = photoUrl;
    this.googleId = googleId;
    this.accessTokenEncrypted = Encryption.encrypt(accessToken);
    this.accessTokenExpiresAt = accessTokenExpiresAt || new Date(Date.now() + ACCESS_TOKEN_EXPIRATION_MS);
    this.refreshTokenEncrypted = Encryption.encrypt(refreshToken);
    this.lastSessionAt = null;
    this.validate();
  }

  toJson() {
    return {
      email: this.email,
      name: this.name,
      photoUrl: this.photoUrl,
    };
  }

  private validate() {
    if (!this.email) throw new Error('Email is required');
    if (!this.name) throw new Error('Name is required');
    if (!this.googleId) throw new Error('Google ID is required');
    if (!this.accessTokenEncrypted) throw new Error('Access token is required');
    if (!this.refreshTokenEncrypted) throw new Error('Refresh token is required');
  }
}
