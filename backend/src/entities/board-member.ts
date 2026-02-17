import { Collection, Entity, Enum, Index, ManyToOne, OneToMany, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
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

  @OneToMany({ mappedBy: (boardCard: BoardCard) => boardCard.assignedBoardMember })
  assignedBoardCards = new Collection<BoardCard>(this);

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

  get isAgent() {
    return this.role === BoardMemberRole.AGENT;
  }

  toJson() {
    return {
      id: this.id,
      user: this.loadedUser.toJson(),
      role: this.role,
      isAgent: this.isAgent,
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.user) throw new Error('User is required');
    if (!this.role) throw new Error('Role is required');
    if (!Object.values(BoardMemberRole).includes(this.role)) throw new Error('Invalid role');
  }
}
