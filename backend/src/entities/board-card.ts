import {
  Collection,
  Entity,
  Enum,
  Index,
  type Loaded,
  ManyToOne,
  OneToMany,
  OneToOne,
  Property,
  Unique,
} from '@mikro-orm/postgresql';
import { BaseEntity } from '@/entities/base-entity';
import type { BoardCardReadPosition } from '@/entities/board-card-read-position';
import { BoardColumn } from '@/entities/board-column';
import { BoardMember } from '@/entities/board-member';
import type { Comment } from '@/entities/comment';
import { Domain } from '@/entities/domain';
import { EmailDraft } from '@/entities/email-draft';
import type { GmailAccount } from '@/entities/gmail-account';
import { type Participant, BoardCardState as State } from '@/utils/shared';

const MAX_SNIPPET_LENGTH = 201;

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
  gmailAccount: GmailAccount; // BoardAccount's or BoardMember.User's Gmail account
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
  externalThreadId?: string;
  @Enum(() => State)
  state: State;

  @Property()
  subject: string;
  @Property()
  snippet: string;
  @Property({ type: 'jsonb' })
  participantsAsc: Participant[];
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
    participantsAsc,
    lastEventAt,
    hasAttachments,
    emailMessageCount,
    pinnedPosition,
    movedToTrashAt,
    participantUserIds,
  }: {
    gmailAccount: GmailAccount;
    boardColumn: BoardColumn;
    domain: Domain;
    externalThreadId?: string;
    state: State;
    subject: string;
    snippet: string;
    participantsAsc: Participant[];
    lastEventAt: Date;
    hasAttachments: boolean;
    emailMessageCount: number;
    pinnedPosition?: number;
    movedToTrashAt?: Date;
    participantUserIds?: string[];
  }) {
    super();
    this.gmailAccount = gmailAccount;
    this.boardColumn = boardColumn;
    this.domain = domain;
    this.externalThreadId = externalThreadId;
    this.state = state;
    this.subject = subject;
    this.snippet = snippet.slice(0, MAX_SNIPPET_LENGTH);
    this.participantsAsc = participantsAsc.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.lastEventAt = lastEventAt;
    this.hasAttachments = hasAttachments;
    this.emailMessageCount = emailMessageCount;
    this.pinnedPosition = pinnedPosition;
    this.movedToTrashAt = movedToTrashAt;
    this.participantUserIds = participantUserIds;
    this.validate();
  }

  update({
    externalThreadId,
    state,
    snippet,
    participantsAsc,
    lastEventAt,
    hasAttachments,
    emailMessageCount,
    movedToTrashAt,
    participantUserIds,
  }: {
    externalThreadId: string;
    state: State;
    snippet: string;
    participantsAsc: Participant[];
    lastEventAt: Date;
    hasAttachments: boolean;
    emailMessageCount: number;
    movedToTrashAt?: Date;
    participantUserIds?: string[];
  }) {
    this.externalThreadId = externalThreadId;
    this.state = state;
    this.snippet = snippet.slice(0, MAX_SNIPPET_LENGTH);
    this.participantsAsc = participantsAsc.map((p) => ({ ...p, email: p.email.toLowerCase() }));
    this.lastEventAt = lastEventAt;
    this.hasAttachments = hasAttachments;
    this.emailMessageCount = emailMessageCount;
    this.movedToTrashAt = movedToTrashAt;
    this.participantUserIds = participantUserIds;
    this.validate();
  }

  get noMessages() {
    return this.emailMessageCount === 0;
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

  setSubject(subject: string) {
    this.subject = subject;
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

  static toJson(boardCard: Loaded<BoardCard, 'domain' | 'emailDraft.fileAttachments'>) {
    return {
      id: boardCard.id,
      domain: Domain.toJson(boardCard.loadedDomain),
      assignedBoardMemberId: boardCard.assignedBoardMember?.id,
      emailDraft: boardCard.emailDraft && EmailDraft.toJson(boardCard.emailDraft),
      gmailAccountId: boardCard.gmailAccount.id,
      boardColumnId: boardCard.boardColumn.id,
      externalThreadId: boardCard.externalThreadId,
      state: boardCard.state,
      subject: boardCard.subject,
      snippet: boardCard.snippet,
      participantsAsc: boardCard.participantsAsc,
      participantUserIds: boardCard.participantUserIds,
      lastEventAt: boardCard.lastEventAt,
      hasAttachments: boardCard.hasAttachments,
      emailMessageCount: boardCard.emailMessageCount,
      pinnedPosition: boardCard.pinnedPosition,
    };
  }

  static toText(boardCard: Loaded<BoardCard, 'assignedBoardMember.user' | 'boardColumn'>) {
    const assignedBoardMember = boardCard.loadedAssignedBoardMember;
    const boardColumn = boardCard.loadedBoardColumn;

    const items = [
      `- ID: ${boardCard.id}`,
      `- Board Column: ${BoardColumn.toStr(boardColumn)}`,
      assignedBoardMember && `- Assigned Board Member: ${BoardMember.toStr(assignedBoardMember)}`,
      `- Subject: ${boardCard.subject}`,
      `- State: ${boardCard.state}`,
    ];

    return `Board Card:
${items.filter(Boolean).join('\n')}`;
  }

  private validate() {
    if (!this.gmailAccount) throw new Error('GmailAccount is required');
    if (!this.boardColumn) throw new Error('BoardColumn is required');
    if (!this.domain) throw new Error('Domain is required');
    if (!this.state) throw new Error('State is required');
    if (!this.subject) throw new Error('Subject is required');
    if (this.snippet === undefined || this.snippet === null) throw new Error('Snippet is required');
    if (this.snippet.length > MAX_SNIPPET_LENGTH)
      throw new Error(`Snippet cannot be longer than ${MAX_SNIPPET_LENGTH} characters`);
    if (!this.participantsAsc || this.participantsAsc.length === 0)
      throw new Error('Participants is required and cannot be empty');
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
