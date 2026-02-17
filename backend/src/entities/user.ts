import { Entity, Property } from '@mikro-orm/postgresql';
import { BaseEntity } from './base-entity';

@Entity({ tableName: 'users' })
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
  @Property()
  accessTokenEncrypted: string;
  @Property()
  accessTokenExpiresAt: Date;
  @Property()
  refreshTokenEncrypted: string;

  constructor({
    email,
    name,
    photoUrl,
    googleId,
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
  }: {
    email: string;
    name: string;
    photoUrl: string;
    googleId: string;
    accessToken: string;
    accessTokenExpiresAt: Date;
    refreshToken: string;
  }) {
    super();
    this.email = email;
    this.name = name;
    this.photoUrl = photoUrl;
    this.googleId = googleId;
    this.accessTokenEncrypted = accessToken;
    this.accessTokenExpiresAt = accessTokenExpiresAt;
    this.refreshTokenEncrypted = refreshToken;
    this.lastSessionAt = null;
  }
}
