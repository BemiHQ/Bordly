import { Entity, Index, ManyToOne, Property } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { User } from '@/entities/user';
import type { BoardCard } from './board-card';

export interface Comment {
  loadedBoardCard: BoardCard;
  loadedUser: User;
}

@Entity({ tableName: 'comments' })
@Index({ properties: ['boardCard'] })
@Index({ properties: ['user'] })
export class Comment extends BaseEntity {
  @ManyToOne()
  boardCard: BoardCard;
  @ManyToOne()
  user: User;

  @Property({ columnType: 'text' })
  text: string;

  constructor({
    boardCard,
    user,
    text,
  }: {
    boardCard: BoardCard;
    user: User;
    text: string;
  }) {
    super();
    this.boardCard = boardCard;
    this.user = user;
    this.text = text;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      boardCardId: this.boardCard.id,
      userId: this.user.id,
      text: this.text,
      createdAt: this.createdAt,
    };
  }

  private validate() {
    if (!this.boardCard) throw new Error('BoardCard is required');
    if (!this.user) throw new Error('User is required');
    if (!this.text) throw new Error('Text is required');
  }
}
