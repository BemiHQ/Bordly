import { Collection, Entity, ManyToMany, OneToMany, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import { BoardMember } from '@/entities/board-member';

@Entity({ tableName: 'users' })
@Unique({ properties: ['email'] })
@Unique({ properties: ['googleId'] })
export class User extends BaseEntity {
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

  // Google OAuth
  @Property()
  googleId: string;

  constructor({
    email,
    name,
    photoUrl,
    googleId,
  }: {
    email: string;
    name: string;
    photoUrl: string;
    googleId: string;
  }) {
    super();
    this.email = email;
    this.name = name;
    this.photoUrl = photoUrl;
    this.googleId = googleId;
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
    if (!this.googleId) throw new Error('Google ID is required');
  }
}
