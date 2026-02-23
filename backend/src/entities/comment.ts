import { Entity, Index, type Loaded, ManyToOne, Property } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { BoardCard } from '@/entities/board-card';
import { User } from '@/entities/user';

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

  static toJson(comment: Loaded<Comment, 'user'>) {
    return {
      id: comment.id,
      boardCardId: comment.boardCard.id,
      user: User.toJson(comment.loadedUser),
      text: comment.text,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
    };
  }

  static toText(comment: Loaded<Comment, 'user'>) {
    const user = comment.loadedUser;
    const items = [
      `- Comment ID: ${comment.id}`,
      `- Created At: ${comment.createdAt.toISOString()}`,
      `- User: ${User.toStr(user)}`,
      `- Text: ${comment.text}`,
    ];

    return `Comment:
${items.join('\n')}`;
  }

  private validate() {
    if (!this.boardCard) throw new Error('BoardCard is required');
    if (!this.user) throw new Error('User is required');
    if (!this.text) throw new Error('Text is required');
  }
}
