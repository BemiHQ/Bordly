import { Entity, Enum, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { User } from '@/entities/user';
import { BoardMemberRole } from '@/utils/shared';

export { BoardMemberRole as Role };

export enum State {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

@Entity({ tableName: 'board_invites' })
@Unique({ properties: ['board', 'email'] })
@Index({ properties: ['email'] })
export class BoardInvite extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  invitedBy: User;

  @Enum(() => State)
  state: State;
  @Property()
  email: string;
  @Enum(() => BoardMemberRole)
  role: BoardMemberRole;

  constructor({
    board,
    state,
    email,
    role,
    invitedBy,
  }: { board: Board; state: State; email: string; role: BoardMemberRole; invitedBy: User }) {
    super();
    this.board = board;
    this.state = state;
    this.email = email;
    this.role = role;
    this.invitedBy = invitedBy;
    this.validate();
  }

  markAsAccepted() {
    this.state = State.ACCEPTED;
    this.validate();
  }

  setRole(role: BoardMemberRole) {
    this.role = role;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      state: this.state,
      email: this.email,
      role: this.role,
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.invitedBy) throw new Error('InvitedBy is required');
    if (!Object.values(State).includes(this.state)) throw new Error('Invalid state');
    if (!this.email) throw new Error('Email is required');
    if (!Object.values(BoardMemberRole).includes(this.role)) throw new Error('Invalid role');
  }
}
