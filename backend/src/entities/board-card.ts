import {
  Collection,
  Entity,
  Enum,
  Index,
  ManyToOne,
  OneToMany,
  OneToOne,
  Property,
  Unique,
} from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { BoardColumn } from '@/entities/board-column';
import type { BoardMember } from '@/entities/board-member';
import type { Comment } from '@/entities/comment';
import type { Domain } from '@/entities/domain';
import type { EmailDraft } from '@/entities/email-draft';
import type { Participant } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { BoardCardState as State } from '@/utils/shared';
import type { BoardCardReadPosition } from './board-card-read-position';

const MAX_SNIPPET_LENGTH = 200;

export { State };

export interface BoardCard {
  loadedGmailAccount: GmailAccount;
  loadedBoardColumn: BoardColumn;
  loadedDomain: Domain;
  loadedAssignedBoardMember?: BoardMember;
}

@Entity({ tableName: 'board_cards' })
@Unique({ properties: ['boardColumn', 'pinnedPosition'] })
@Index({ properties: ['gmailAccount'] })
@Index({ properties: ['lastEventAt'] })
@Index({ properties: ['assignedBoardMember'] })
export class BoardCard extends BaseEntity {
  @ManyToOne()
  gmailAccount: GmailAccount;
  @ManyToOne()
  boardColumn: BoardColumn;
  @ManyToOne()
  domain: Domain;
  @ManyToOne()
  assignedBoardMember?: BoardMember;

  @OneToOne({ mappedBy: (emailDraft: EmailDraft) => emailDraft.boardCard, nullable: true })
  emailDraft?: EmailDraft;
  @OneToMany({ mappedBy: (comment: Comment) => comment.boardCard })
  comments = new Collection<Comment>(this);
  @OneToMany({ mappedBy: (readPosition: BoardCardReadPosition) => readPosition.boardCard })
  boardCardReadPositions = new Collection<BoardCardReadPosition>(this);

  @Property()
  externalThreadId: string;
  @Enum(() => State)
  state: State;

  @Property()
  subject: string;
  @Property()
  snippet: string;
  @Property({ type: 'jsonb' })
  externalParticipantsAsc: Participant[];
  @Property()
  participantUserIds?: string[];
  @Property()
  lastEventAt: Date;

  @Property()
  hasAttachments: boolean;
  @Property()
  emailMessageCount: number;

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
    externalParticipantsAsc,
    lastEventAt,
    hasAttachments,
    emailMessageCount,
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
    externalParticipantsAsc: Participant[];
    lastEventAt: Date;
    hasAttachments: boolean;
    emailMessageCount: number;
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
    this.snippet = snippet.slice(0, MAX_SNIPPET_LENGTH);
    this.externalParticipantsAsc = externalParticipantsAsc;
    this.lastEventAt = lastEventAt;
    this.hasAttachments = hasAttachments;
    this.emailMessageCount = emailMessageCount;
    this.pinnedPosition = pinnedPosition;
    this.movedToTrashAt = movedToTrashAt;
    this.validate();
  }

  update({
    state,
    snippet,
    externalParticipantsAsc,
    lastEventAt,
    hasAttachments,
    emailMessageCount,
    movedToTrashAt,
  }: {
    state: State;
    snippet: string;
    externalParticipantsAsc: Participant[];
    lastEventAt: Date;
    hasAttachments: boolean;
    emailMessageCount: number;
    movedToTrashAt?: Date;
  }) {
    this.state = state;
    this.snippet = snippet.slice(0, MAX_SNIPPET_LENGTH);
    this.externalParticipantsAsc = externalParticipantsAsc;
    this.lastEventAt = lastEventAt;
    this.hasAttachments = hasAttachments;
    this.emailMessageCount = emailMessageCount;
    this.movedToTrashAt = movedToTrashAt;
    this.validate();
  }

  setBoardColumn(boardColumn: BoardColumn) {
    this.boardColumn = boardColumn;
    this.validate();
  }

  setState(state: State) {
    this.state = state;
    if (state === State.TRASH) {
      this.movedToTrashAt = new Date();
    } else if (this.movedToTrashAt) {
      this.movedToTrashAt = undefined;
    }
    this.validate();
  }

  setLastEventAt(lastEventAt: Date) {
    this.lastEventAt = lastEventAt;
    this.validate();
  }

  setSnippet(snippet: string) {
    this.snippet = snippet.slice(0, MAX_SNIPPET_LENGTH);
    this.validate();
  }

  assignToBoardMember(boardMember: BoardMember) {
    this.assignedBoardMember = boardMember;
    this.validate();
  }

  unassignBoardMember() {
    this.assignedBoardMember = undefined;
    this.validate();
  }

  addParticipantUserId(userId: string) {
    if (!this.participantUserIds || !this.participantUserIds.includes(userId)) {
      this.participantUserIds = [...(this.participantUserIds || []), userId];
      this.validate();
    }
  }

  toJson() {
    return {
      id: this.id,
      domain: this.loadedDomain.toJson(),
      assignedBoardMemberId: this.assignedBoardMember?.id,
      emailDraft: this.emailDraft?.toJson(),
      gmailAccountId: this.gmailAccount.id,
      boardColumnId: this.boardColumn.id,
      externalThreadId: this.externalThreadId,
      state: this.state,
      subject: this.subject,
      snippet: this.snippet,
      externalParticipantsAsc: this.externalParticipantsAsc,
      participantUserIds: this.participantUserIds,
      lastEventAt: this.lastEventAt,
      hasAttachments: this.hasAttachments,
      emailMessageCount: this.emailMessageCount,
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
    if (this.snippet.length > MAX_SNIPPET_LENGTH)
      throw new Error(`Snippet cannot be longer than ${MAX_SNIPPET_LENGTH} characters`);
    if (!this.externalParticipantsAsc || this.externalParticipantsAsc.length === 0)
      throw new Error('External participants is required and cannot be empty');
    if (!this.lastEventAt) throw new Error('LastEventAt is required');
    if (this.hasAttachments === undefined || this.hasAttachments === null)
      throw new Error('HasAttachments is required');
    if (this.emailMessageCount !== undefined && this.emailMessageCount !== null && this.emailMessageCount < 0)
      throw new Error('EmailMessageCount must be non-negative');
    if (this.pinnedPosition !== undefined && this.pinnedPosition !== null && this.pinnedPosition < 0)
      throw new Error('Position must be non-negative');
    if (this.state === State.TRASH && !this.movedToTrashAt)
      throw new Error('MovedToTrashAt is required when state is TRASH');
    if (this.state !== State.TRASH && this.movedToTrashAt)
      throw new Error('MovedToTrashAt must be null unless state is TRASH');
    if (this.participantUserIds?.length === 0) throw new Error('ParticipantUserIds cannot be empty array');
  }
}
