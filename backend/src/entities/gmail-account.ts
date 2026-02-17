import { Collection, Entity, Index, ManyToOne, OneToMany, Property, Unique } from '@mikro-orm/postgresql';

import type { Attachment } from '@/entities/attachment';
import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { EmailMessage } from '@/entities/email-message';
import type { User } from '@/entities/user';
import { Encryption } from '@/utils/encryption';

@Entity({ tableName: 'gmail_accounts' })
@Unique({ properties: ['googleId'] })
@Index({ properties: ['user'] })
export class GmailAccount extends BaseEntity {
  @ManyToOne()
  board?: Board;
  @ManyToOne()
  user: User;

  @OneToMany({ mappedBy: (emailMessage: EmailMessage) => emailMessage.gmailAccount })
  emailMessages = new Collection<EmailMessage>(this);
  @OneToMany({ mappedBy: (attachment: Attachment) => attachment.gmailAccount })
  attachments = new Collection<Attachment>(this);

  @Property()
  email: string;
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
    email,
    googleId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }: {
    user: User;
    email: string;
    googleId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
  }) {
    super();
    this.email = email;
    this.user = user;
    this.googleId = googleId;
    this.accessTokenEncrypted = Encryption.encrypt(accessToken);
    this.accessTokenExpiresAt = accessTokenExpiresAt;
    this.refreshTokenEncrypted = Encryption.encrypt(refreshToken);
    this.validate();
  }

  get accessToken(): string {
    return Encryption.decrypt(this.accessTokenEncrypted);
  }

  get refreshToken(): string {
    return Encryption.decrypt(this.refreshTokenEncrypted);
  }

  isAccessTokenExpired(): boolean {
    return this.accessTokenExpiresAt <= new Date();
  }

  updateAccessToken(accessToken: string, expiresAt: Date) {
    this.accessTokenEncrypted = Encryption.encrypt(accessToken);
    this.accessTokenExpiresAt = expiresAt;
  }

  private validate() {
    if (!this.user) throw new Error('User is required');
    if (!this.email) throw new Error('Email is required');
    if (!this.googleId) throw new Error('Google ID is required');
    if (!this.accessTokenEncrypted) throw new Error('Access token is required');
    if (!this.accessTokenExpiresAt) throw new Error('Access token expiration date is required');
    if (!this.refreshTokenEncrypted) throw new Error('Refresh token is required');
  }
}
