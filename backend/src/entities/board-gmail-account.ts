import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import { Encryption } from '@/utils/encryption';

const ACCESS_TOKEN_EXPIRATION_MS = (3_600 - 5) * 1_000; // 1 hour - 5 seconds buffer

@Entity({ tableName: 'board_gmail_accounts' })
@Unique({ properties: ['board', 'googleId'] })
export class BoardGmailAccount extends BaseEntity {
  @ManyToOne()
  board: Board;

  @Property()
  googleId: string;
  @Property({ columnType: 'text' })
  accessTokenEncrypted: string;
  @Property()
  accessTokenExpiresAt: Date;
  @Property({ columnType: 'text' })
  refreshTokenEncrypted: string;

  constructor({
    board,
    googleId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
  }: {
    board: Board;
    googleId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt?: Date;
  }) {
    super();
    this.board = board;
    this.googleId = googleId;
    this.accessTokenEncrypted = Encryption.encrypt(accessToken);
    this.accessTokenExpiresAt = accessTokenExpiresAt || new Date(Date.now() + ACCESS_TOKEN_EXPIRATION_MS);
    this.refreshTokenEncrypted = Encryption.encrypt(refreshToken);
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required for BoardMember');
    if (!this.googleId) throw new Error('Google ID is required');
    if (!this.accessTokenEncrypted) throw new Error('Access token is required');
    if (!this.accessTokenExpiresAt) throw new Error('Access token expiration date is required');
    if (!this.refreshTokenEncrypted) throw new Error('Refresh token is required');
  }
}
