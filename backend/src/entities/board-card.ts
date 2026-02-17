import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { BoardColumn } from '@/entities/board-column';

@Entity({ tableName: 'board_cards' })
@Unique({ properties: ['boardColumn', 'pinnedPosition'] })
@Index({ properties: ['board'] })
export class BoardCard extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  boardColumn: BoardColumn;

  @Property()
  externalThreadId: string;
  @Property({ nullable: true })
  pinnedPosition?: number;

  constructor({
    board,
    boardColumn,
    externalThreadId,
    pinnedPosition,
  }: {
    board: Board;
    boardColumn: BoardColumn;
    externalThreadId: string;
    pinnedPosition?: number;
  }) {
    super();
    this.board = board;
    this.boardColumn = boardColumn;
    this.externalThreadId = externalThreadId;
    this.pinnedPosition = pinnedPosition;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      externalThreadId: this.externalThreadId,
      pinnedPosition: this.pinnedPosition,
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.boardColumn) throw new Error('BoardColumn is required');
    if (!this.externalThreadId) throw new Error('ExternalThreadId is required');
    if (this.pinnedPosition !== undefined && this.pinnedPosition !== null && this.pinnedPosition < 0)
      throw new Error('Position must be non-negative');
  }
}
