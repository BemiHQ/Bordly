import { Collection, Entity, type Loaded, OneToMany, OneToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { BoardCardReadPosition } from '@/entities/board-card-read-position';
import type { BoardMember } from '@/entities/board-member';
import type { Comment } from '@/entities/comment';
import type { EmailDraft } from '@/entities/email-draft';
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
  @OneToMany({ mappedBy: (emailDraft: EmailDraft) => emailDraft.lastEditedByUser })
  lastEditedEmailDrafts = new Collection<EmailDraft>(this);

  @Property()
  email: string;
  @Property()
  fullName: string;
  @Property()
  firstName: string;
  @Property({ columnType: 'text' })
  photoUrl: string;
  @Property()
  lastSessionAt?: Date;

  constructor({
    email,
    fullName,
    firstName,
    photoUrl,
  }: {
    email: string;
    fullName: string;
    firstName: string;
    photoUrl: string;
  }) {
    super();
    this.email = email.toLowerCase();
    this.fullName = fullName;
    this.firstName = firstName;
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

  static toJson(user: Loaded<User>) {
    return {
      id: user.id,
      fullName: user.fullName,
      firstName: user.firstName,
      email: user.isBordly ? '' : user.email,
      photoUrl: user.photoUrl,
    };
  }

  static toStr(user: Loaded<User>) {
    return `${user.fullName} <${user.email}>`;
  }

  private validate() {
    if (!this.email) throw new Error('Email is required');
    if (!this.fullName) throw new Error('Full name is required');
    if (!this.firstName) throw new Error('First name is required');
  }
}
