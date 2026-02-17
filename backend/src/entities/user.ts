import { Collection, Entity, OneToMany, OneToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { BoardCardReadPosition } from '@/entities/board-card-read-position';
import type { BoardMember } from '@/entities/board-member';
import type { Comment } from '@/entities/comment';
import type { GmailAccount } from '@/entities/gmail-account';

export const BORDLY_USER_ID = '00000000-0000-0000-0000-000000000000';

@Entity({ tableName: 'users' })
@Unique({ properties: ['email'] })
export class User extends BaseEntity {
  @OneToOne({ mappedBy: (gmailAccount: GmailAccount) => gmailAccount.user })
  gmailAccount!: GmailAccount;
  @OneToMany({ mappedBy: (boardMember: BoardMember) => boardMember.user })
  boardMembers = new Collection<BoardMember>(this);
  @OneToMany({ mappedBy: (readPosition: BoardCardReadPosition) => readPosition.user })
  boardCardReadPositions = new Collection<BoardCardReadPosition>(this);
  @OneToMany({ mappedBy: (comment: Comment) => comment.user })
  comments = new Collection<Comment>(this);

  @Property()
  email: string;
  @Property()
  name: string;
  @Property({ columnType: 'text' })
  photoUrl: string;
  @Property()
  lastSessionAt?: Date;

  constructor({
    email,
    name,
    photoUrl,
  }: {
    email: string;
    name: string;
    photoUrl: string;
  }) {
    super();
    this.email = email;
    this.name = name;
    this.photoUrl = photoUrl;
    this.lastSessionAt = undefined;
    this.validate();
  }

  get isBordly() {
    return this.id === BORDLY_USER_ID;
  }

  touchLastSessionAt() {
    this.lastSessionAt = new Date();
  }

  toJson() {
    return {
      id: this.id,
      name: this.name,
      email: this.isBordly ? '' : this.email,
      photoUrl: this.photoUrl,
    };
  }

  private validate() {
    if (!this.email) throw new Error('Email is required');
    if (!this.name) throw new Error('Name is required');
  }
}
