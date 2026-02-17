import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { BoardColumn } from '@/entities/board-column';

@Entity({ tableName: 'board_cards' })
@Unique({ properties: ['boardColumn', 'position'] })
@Index({ properties: ['board'] })
export class BoardCard extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  boardColumn: BoardColumn;

  @Property()
  name: string;
  @Property()
  participants: string[];
  @Property()
  snippet: string;
  @Property()
  position: number;

  constructor({
    board,
    boardColumn,
    name,
    participants,
    snippet,
    position,
  }: {
    board: Board;
    boardColumn: BoardColumn;
    name: string;
    participants: string[];
    snippet: string;
    position: number;
  }) {
    super();
    this.board = board;
    this.boardColumn = boardColumn;
    this.name = name;
    this.participants = participants;
    this.snippet = snippet;
    this.position = position;
    this.validate();
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.boardColumn) throw new Error('BoardColumn is required');
    if (!this.name) throw new Error('Name is required');
    if (!this.participants) throw new Error('Participants are required');
    if (!this.snippet) throw new Error('Snippet is required');
    if (!this.position || this.position < 0) throw new Error('Position is required and must be non-negative');
  }
}
