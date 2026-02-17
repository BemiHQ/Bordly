import { Entity, Enum, Index, ManyToOne, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { User } from '@/entities/user';
import { BoardMemberRole } from '@/utils/shared';

export { BoardMemberRole as Role };

export interface BoardMember {
  loadedBoard: Board;
  loadedUser: User;
}

@Entity({ tableName: 'board_members' })
@Unique({ properties: ['board', 'user'] })
@Index({ properties: ['user'] })
export class BoardMember extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  user: User;

  @Enum(() => BoardMemberRole)
  role: BoardMemberRole;

  constructor({ board, user, role }: { board: Board; user: User; role: BoardMemberRole }) {
    super();
    this.board = board;
    this.user = user;
    this.role = role;
    this.validate();
  }

  setRole(role: BoardMemberRole) {
    this.role = role;
    this.validate();
  }

  toJson() {
    return {
      user: this.loadedUser.toJson(),
      role: this.role,
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.user) throw new Error('User is required');
    if (!this.role) throw new Error('Role is required');
    if (!Object.values(BoardMemberRole).includes(this.role)) throw new Error('Invalid role');
  }
}
