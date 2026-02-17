import { Entity, Enum, Index, ManyToOne, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { User } from '@/entities/user';

export enum Role {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
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

  constructor({ board, user, role }: { board: Board; user: User; role: Role }) {
    super();
    this.board = board;
    this.user = user;
    this.role = role;
    this.validate();
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.user) throw new Error('User is required');
    if (!this.role) throw new Error('Role is required');
    if (!Object.values(Role).includes(this.role)) throw new Error('Invalid role');
  }
}
