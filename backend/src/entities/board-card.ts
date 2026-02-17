import { Entity, Enum, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { Board } from '@/entities/board';
import type { BoardColumn } from '@/entities/board-column';
import type { Domain } from '@/entities/domain';

export enum State {
  INBOX = 'INBOX',
  ARCHIVED = 'ARCHIVED',
  SPAM = 'SPAM',
  TRASHED = 'TRASHED',
}

@Entity({ tableName: 'board_cards' })
@Unique({ properties: ['boardColumn', 'pinnedPosition'] })
@Index({ properties: ['board'] })
@Index({ properties: ['lastEventAt'] })
export class BoardCard extends BaseEntity {
  @ManyToOne()
  board: Board;
  @ManyToOne()
  boardColumn: BoardColumn;
  @ManyToOne()
  domain: Domain;

  @Property()
  externalThreadId: string;
  @Enum(() => State)
  state: State;

  @Property()
  subject: string;
  @Property()
  snippet: string;
  @Property()
  participantNames: string[];
  @Property()
  lastEventAt: Date;
  @Property({ type: 'jsonb', nullable: true })
  unreadEmailMessageIds?: string[];

  @Property({ nullable: true })
  pinnedPosition?: number;
  @Property({ nullable: true })
  movedToTrashAt?: Date;

  constructor({
    board,
    boardColumn,
    domain,
    externalThreadId,
    state,
    subject,
    snippet,
    participantNames,
    lastEventAt,
    unreadEmailMessageIds,
    pinnedPosition,
    movedToTrashAt,
  }: {
    board: Board;
    boardColumn: BoardColumn;
    domain: Domain;
    externalThreadId: string;
    state: State;
    subject: string;
    snippet: string;
    participantNames: string[];
    lastEventAt: Date;
    unreadEmailMessageIds?: string[];
    pinnedPosition?: number;
    movedToTrashAt?: Date;
  }) {
    super();
    this.board = board;
    this.boardColumn = boardColumn;
    this.domain = domain;
    this.externalThreadId = externalThreadId;
    this.state = state;
    this.subject = subject;
    this.snippet = snippet;
    this.participantNames = participantNames;
    this.lastEventAt = lastEventAt;
    this.unreadEmailMessageIds = unreadEmailMessageIds;
    this.pinnedPosition = pinnedPosition;
    this.movedToTrashAt = movedToTrashAt;
    this.validate();
  }

  update({
    state,
    snippet,
    participantNames,
    lastEventAt,
    unreadEmailMessageIds,
    movedToTrashAt,
  }: {
    state: State;
    snippet: string;
    participantNames: string[];
    lastEventAt: Date;
    unreadEmailMessageIds?: string[];
    movedToTrashAt?: Date;
  }) {
    this.state = state;
    this.snippet = snippet;
    this.participantNames = participantNames;
    this.lastEventAt = lastEventAt;
    this.unreadEmailMessageIds = unreadEmailMessageIds;
    this.movedToTrashAt = movedToTrashAt;
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      boardColumnId: this.boardColumn.id,
      externalThreadId: this.externalThreadId,
      domain: this.domain.toJson(),
      state: this.state,
      subject: this.subject,
      snippet: this.snippet,
      participantNames: this.participantNames,
      lastEventAt: this.lastEventAt,
      unreadEmailMessageIds: this.unreadEmailMessageIds,
      pinnedPosition: this.pinnedPosition,
    };
  }

  private validate() {
    if (!this.board) throw new Error('Board is required');
    if (!this.boardColumn) throw new Error('BoardColumn is required');
    if (!this.externalThreadId) throw new Error('ExternalThreadId is required');
    if (!this.state) throw new Error('State is required');
    if (!this.subject) throw new Error('Subject is required');
    if (!this.snippet) throw new Error('Snippet is required');
    if (!this.participantNames || this.participantNames.length === 0)
      throw new Error('ParticipantNames is required and cannot be empty');
    if (!this.lastEventAt) throw new Error('LastEventAt is required');
    if (this.unreadEmailMessageIds && this.unreadEmailMessageIds.length === 0)
      throw new Error('UnreadEmailMessageIds cannot be an empty array');
    if (this.pinnedPosition !== undefined && this.pinnedPosition !== null && this.pinnedPosition < 0)
      throw new Error('Position must be non-negative');
    if (this.state === State.TRASHED && !this.movedToTrashAt)
      throw new Error('MovedToTrashAt is required when state is TRASHED');
    if (this.state !== State.TRASHED && this.movedToTrashAt)
      throw new Error('MovedToTrashAt must be null unless state is TRASHED');
  }
}
