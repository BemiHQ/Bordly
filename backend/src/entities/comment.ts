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
  @Property()
  editedAt?: Date;

  constructor({
    boardCard,
    user,
    text,
    createdAt,
  }: {
    boardCard: BoardCard;
    user: User;
    text: string;
    createdAt?: Date;
  }) {
    super();
    this.boardCard = boardCard;
    this.user = user;
    this.text = text;
    this.createdAt = createdAt ?? new Date();
    this.validate();
  }

  update({ text }: { text: string }) {
    this.text = text;
    this.editedAt = new Date();
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      boardCardId: this.boardCard.id,
      user: this.loadedUser.toJson(),
      text: this.text,
      createdAt: this.createdAt,
      editedAt: this.editedAt,
    };
  }

  private validate() {
    if (!this.boardCard) throw new Error('BoardCard is required');
    if (!this.user) throw new Error('User is required');
    if (!this.text) throw new Error('Text is required');
  }
}
