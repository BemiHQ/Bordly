import { Entity, Enum, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { User } from '@/entities/user';

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

  @Property()
  email: string;
  @Enum(() => State)
  state: State = State.PENDING;

  constructor({ board, email, invitedBy }: { board: Board; email: string; invitedBy: User }) {
    super();
    this.board = board;
    this.email = email;
    this.invitedBy = invitedBy;
    this.validate();
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.invitedBy) throw new Error('InvitedBy is required');
    if (!this.email) throw new Error('Email is required');
    if (!Object.values(State).includes(this.state)) throw new Error('Invalid state');
  }
}
