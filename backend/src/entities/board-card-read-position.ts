import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { BoardCard } from '@/entities/board-card';
import type { User } from '@/entities/user';
import { BoardCardState as State } from '@/utils/shared';

export { State };

export interface BoardCardReadPosition {
  loadedBoardCard: BoardCard;
  loadedUser: User;
}

@Entity({ tableName: 'board_card_read_positions' })
@Unique({ properties: ['boardCard', 'user'] })
export class BoardCardReadPosition extends BaseEntity {
  @ManyToOne()
  boardCard: BoardCard;
  @ManyToOne()
  user: User;

  @Property()
  lastReadAt: Date;

  constructor({
    boardCard,
    user,
    lastReadAt,
  }: {
    boardCard: BoardCard;
    user: User;
    lastReadAt: Date;
  }) {
    super();
    this.boardCard = boardCard;
    this.user = user;
    this.lastReadAt = lastReadAt;
    this.validate();
  }

  setLastReadAt(lastReadAt: Date) {
    this.lastReadAt = lastReadAt;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      boardCardId: this.boardCard.id,
      userId: this.user.id,
      lastReadAt: this.lastReadAt,
    };
  }

  private validate() {
    if (!this.boardCard) throw new Error('BoardCard is required');
    if (!this.user) throw new Error('User is required');
    if (!this.lastReadAt) throw new Error('LastReadAt is required');
  }
}
