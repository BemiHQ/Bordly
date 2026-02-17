import { Collection, Entity, ManyToOne, OneToMany, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';

@Entity({ tableName: 'board_columns' })
@Unique({ properties: ['board', 'position'] })
@Unique({ properties: ['board', 'name'] })
export class BoardColumn extends BaseEntity {
  @ManyToOne()
  board: Board;

  @OneToMany({ mappedBy: (boardCard: BoardCard) => boardCard.boardColumn })
  boardCards = new Collection<BoardCard>(this);

  @Property()
  name: string;
  @Property({ type: 'text' })
  description: string;
  @Property()
  position: number;

  constructor({
    board,
    name,
    description,
    position,
  }: { board: Board; name: string; description: string; position: number }) {
    super();
    this.board = board;
    this.name = name;
    this.description = description;
    this.position = position;
    this.validate();
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.name) throw new Error('Name is required');
    if (!this.description) throw new Error('Description is required');
    if (!this.position || this.position < 0) throw new Error('Position is required and must be non-negative');
  }
}
