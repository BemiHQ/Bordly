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
  contentText: string;
  @Property({ columnType: 'text' })
  contentHtml: string;
  @Property()
  editedAt?: Date;

  constructor({
    boardCard,
    user,
    contentText,
    contentHtml,
    createdAt,
  }: {
    boardCard: BoardCard;
    user: User;
    contentText: string;
    contentHtml: string;
    createdAt?: Date;
  }) {
    super();
    this.boardCard = boardCard;
    this.user = user;
    this.contentText = contentText;
    this.contentHtml = contentHtml;
    this.createdAt = createdAt ?? new Date();
    this.validate();
  }

  update({ contentText, contentHtml }: { contentText: string; contentHtml: string }) {
    this.contentText = contentText;
    this.contentHtml = contentHtml;
    this.editedAt = new Date();
    this.validate();
  }

  static toJson(comment: Loaded<Comment, 'user'>) {
    return {
      id: comment.id,
      boardCardId: comment.boardCard.id,
      user: User.toJson(comment.loadedUser),
      contentHtml: comment.contentHtml,
      contentText: comment.contentText,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
    };
  }

  static toText(comment: Loaded<Comment, 'user'>) {
    const user = comment.loadedUser;
    const items = [
      `- ID: ${comment.id}`,
      `- Created At: ${comment.createdAt.toISOString()}`,
      `- User: ${User.toStr(user)}`,
      `- Content: ${comment.contentText}`,
    ];

    return `Comment:
${items.join('\n')}`;
  }

  private validate() {
    if (!this.boardCard) throw new Error('BoardCard is required');
    if (!this.user) throw new Error('User is required');
    if (!this.contentHtml) throw new Error('Content html is required');
    if (!this.contentText) throw new Error('Content text is required');
  }
}
