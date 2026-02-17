import { Collection, Entity, Index, ManyToOne, OneToMany, Property, Unique } from '@mikro-orm/postgresql';

import type { Attachment } from '@/entities/attachment';
import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import type { EmailMessage } from '@/entities/email-message';
import type { User } from '@/entities/user';
import { Encryption } from '@/utils/encryption';

@Entity({ tableName: 'gmail_accounts' })
@Unique({ properties: ['externalId'] })
@Unique({ properties: ['email'] })
@Index({ properties: ['user'] })
export class GmailAccount extends BaseEntity {
  @ManyToOne()
  board?: Board;
  @ManyToOne()
  user: User;

  @OneToMany({ mappedBy: (boardCard: BoardCard) => boardCard.gmailAccount })
  boardCards = new Collection<BoardCard>(this);
  @OneToMany({ mappedBy: (emailMessage: EmailMessage) => emailMessage.gmailAccount })
  emailMessages = new Collection<EmailMessage>(this);
  @OneToMany({ mappedBy: (attachment: Attachment) => attachment.gmailAccount })
  attachments = new Collection<Attachment>(this);

  @Property()
  name: string;
  @Property()
  email: string;
  @Property({ columnType: 'text' })
  accessTokenEncrypted: string;
  @Property()
  accessTokenExpiresAt: Date;
  @Property({ columnType: 'text' })
  refreshTokenEncrypted: string;
  @Property()
  externalId: string;
  @Property()
  externalHistoryId?: string;

  constructor({
    user,
    name,
    email,
    externalId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }: {
    user: User;
    name: string;
    email: string;
    externalId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
  }) {
    super();
    this.email = email;
    this.name = name;
    this.user = user;
    this.externalId = externalId;
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

  addToBoard(board: Board) {
    this.board = board;
  }
  deleteFromBoard() {
    this.board = undefined;
  }

  setTokens({
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
  }) {
    this.accessTokenEncrypted = Encryption.encrypt(accessToken);
    this.refreshTokenEncrypted = Encryption.encrypt(refreshToken);
    this.accessTokenExpiresAt = accessTokenExpiresAt;
  }

  setExternalHistoryId(externalHistoryId: string) {
    this.externalHistoryId = externalHistoryId;
  }

  toJson() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    };
  }

  private validate() {
    if (!this.user) throw new Error('User is required');
    if (!this.name) throw new Error('Name is required');
    if (!this.email) throw new Error('Email is required');
    if (!this.externalId) throw new Error('External ID is required');
    if (!this.accessTokenEncrypted) throw new Error('Access token is required');
    if (!this.accessTokenExpiresAt) throw new Error('Access token expiration date is required');
    if (!this.refreshTokenEncrypted) throw new Error('Refresh token is required');
  }
}
