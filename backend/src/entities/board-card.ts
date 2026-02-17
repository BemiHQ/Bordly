import { Entity, Enum, Index, ManyToOne, Property, Unique } from '@mikro-orm/postgresql';

import { BaseEntity } from '@/entities/base-entity';
import type { BoardColumn } from '@/entities/board-column';
import type { Domain } from '@/entities/domain';
import type { Participant } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { BoardCardState as State } from '@/utils/shared';

export { State };

@Entity({ tableName: 'board_cards' })
@Unique({ properties: ['boardColumn', 'pinnedPosition'] })
@Index({ properties: ['gmailAccount'] })
@Index({ properties: ['lastEventAt'] })
export class BoardCard extends BaseEntity {
  @ManyToOne()
  gmailAccount: GmailAccount;
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
  @Property({ type: 'jsonb' })
  participants: Participant[];
  @Property()
  lastEventAt: Date;

  @Property()
  hasSent: boolean;
  @Property()
  hasAttachments?: boolean; // TODO: make this required
  @Property()
  emailMessageCount: number;
  @Property({ type: 'jsonb' })
  unreadEmailMessageIds?: string[];

  @Property()
  pinnedPosition?: number;
  @Property()
  movedToTrashAt?: Date;

  constructor({
    gmailAccount,
    boardColumn,
    domain,
    externalThreadId,
    state,
    subject,
    snippet,
    participants,
    lastEventAt,
    hasSent,
    hasAttachments,
    emailMessageCount,
    unreadEmailMessageIds,
    pinnedPosition,
    movedToTrashAt,
  }: {
    gmailAccount: GmailAccount;
    boardColumn: BoardColumn;
    domain: Domain;
    externalThreadId: string;
    state: State;
    subject: string;
    snippet: string;
    participants: Participant[];
    lastEventAt: Date;
    hasSent: boolean;
    hasAttachments: boolean;
    emailMessageCount: number;
    unreadEmailMessageIds?: string[];
    pinnedPosition?: number;
    movedToTrashAt?: Date;
  }) {
    super();
    this.gmailAccount = gmailAccount;
    this.boardColumn = boardColumn;
    this.domain = domain;
    this.externalThreadId = externalThreadId;
    this.state = state;
    this.subject = subject;
    this.snippet = snippet;
    this.participants = participants;
    this.lastEventAt = lastEventAt;
    this.hasSent = hasSent;
    this.hasAttachments = hasAttachments;
    this.emailMessageCount = emailMessageCount;
    this.unreadEmailMessageIds = unreadEmailMessageIds;
    this.pinnedPosition = pinnedPosition;
    this.movedToTrashAt = movedToTrashAt;
    this.validate();
  }

  update({
    state,
    snippet,
    participants,
    lastEventAt,
    hasSent,
    hasAttachments,
    emailMessageCount,
    unreadEmailMessageIds,
    movedToTrashAt,
  }: {
    state: State;
    snippet: string;
    participants: Participant[];
    lastEventAt: Date;
    hasSent: boolean;
    hasAttachments: boolean;
    emailMessageCount: number;
    unreadEmailMessageIds?: string[];
    movedToTrashAt?: Date;
  }) {
    this.state = state;
    this.snippet = snippet;
    this.participants = participants;
    this.lastEventAt = lastEventAt;
    this.hasSent = hasSent;
    this.hasAttachments = hasAttachments;
    this.emailMessageCount = emailMessageCount;
    this.unreadEmailMessageIds = unreadEmailMessageIds;
    this.movedToTrashAt = movedToTrashAt;
    this.validate();
  }

  setUnreadEmailMessageIds(unreadEmailMessageIds: string[] | undefined) {
    this.unreadEmailMessageIds = unreadEmailMessageIds;
    this.validate();
  }

  setBoardColumn(boardColumn: BoardColumn) {
    this.boardColumn = boardColumn;
    this.validate();
  }

  setState(state: State) {
    this.state = state;
    if (state === State.TRASHED) {
      this.movedToTrashAt = new Date();
    } else if (this.movedToTrashAt) {
      this.movedToTrashAt = undefined;
    }
    this.validate();
  }

  toJson() {
    return {
      id: this.id,
      gmailAccountId: this.gmailAccount.id,
      boardColumnId: this.boardColumn.id,
      externalThreadId: this.externalThreadId,
      domain: this.domain.toJson(),
      state: this.state,
      subject: this.subject,
      snippet: this.snippet,
      participants: this.participants,
      lastEventAt: this.lastEventAt,
      hasSent: this.hasSent,
      hasAttachments: this.hasAttachments,
      emailMessageCount: this.emailMessageCount,
      unreadEmailMessageIds: this.unreadEmailMessageIds,
      pinnedPosition: this.pinnedPosition,
    };
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('GmailAccount is required');
    if (!this.boardColumn) throw new Error('BoardColumn is required');
    if (!this.domain) throw new Error('Domain is required');
    if (!this.externalThreadId) throw new Error('ExternalThreadId is required');
    if (!this.state) throw new Error('State is required');
    if (!this.subject) throw new Error('Subject is required');
    if (this.snippet === undefined || this.snippet === null) throw new Error('Snippet is required');
    if (!this.participants || this.participants.length === 0)
      throw new Error('Participants is required and cannot be empty');
    if (!this.lastEventAt) throw new Error('LastEventAt is required');
    if (this.hasSent === undefined || this.hasSent === null) throw new Error('HasSent is required');
    if (this.hasAttachments === undefined || this.hasAttachments === null)
      throw new Error('HasAttachments is required');
    if (this.emailMessageCount !== undefined && this.emailMessageCount !== null && this.emailMessageCount < 0)
      throw new Error('EmailMessageCount must be non-negative');
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
