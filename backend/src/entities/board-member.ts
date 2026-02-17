import { Entity, Enum, Index, ManyToOne, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { User } from '@/entities/user';

export enum Role {
  ADMIN = 'ADMIN',
}

@Entity({ tableName: 'board_members' })
@Unique({ properties: ['board', 'user'] })
@Index({ properties: ['user'] })
export class BoardMember extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  user: User;

  @Enum(() => Role)
  role: Role;

  constructor({ board, user }: { board: Board; user: User }) {
    super();
    this.board = board;
    this.user = user;
    this.role = Role.ADMIN;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required for BoardMember');
    if (!this.user) throw new Error('User is required for BoardMember');
  }
}
