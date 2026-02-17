import { Collection, Entity, ManyToMany, OneToMany, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import { BoardMember } from '@/entities/board-member';
import type { GmailAccount } from '@/entities/gmail-account';

@Entity({ tableName: 'users' })
@Unique({ properties: ['email'] })
export class User extends BaseEntity {
  @OneToMany({ mappedBy: (gmailAccount: GmailAccount) => gmailAccount.user })
  gmailAccounts = new Collection<GmailAccount>(this);
  @OneToMany({ mappedBy: (boardMember: BoardMember) => boardMember.user })
  boardMembers = new Collection<BoardMember>(this);
  @ManyToMany({ mappedBy: (board: Board) => board.users, owner: true, pivotEntity: () => BoardMember })
  boards = new Collection<Board>(this);

  @Property()
  email: string;
  @Property()
  name: string;
  @Property({ columnType: 'text' })
  photoUrl: string;
  @Property({ nullable: true })
  lastSessionAt: Date | null;

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
    this.lastSessionAt = null;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      name: this.name,
      photoUrl: this.photoUrl,
      boards: this.boards.getItems().map((board) => board.toJson()),
    };
  }

  private validate() {
    if (!this.email) throw new Error('Email is required');
    if (!this.name) throw new Error('Name is required');
  }
}
