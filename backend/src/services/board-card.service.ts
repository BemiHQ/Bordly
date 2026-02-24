import type { AutoPath, Loaded, Populate, PopulatePath } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import type { BoardAccount } from '@/entities/board-account';
import { BoardCard, State } from '@/entities/board-card';
import { BoardCardReadPosition } from '@/entities/board-card-read-position';
import type { BoardColumn } from '@/entities/board-column';
import { Comment } from '@/entities/comment';
import { Domain } from '@/entities/domain';
import { EmailDraft } from '@/entities/email-draft';
import type { EmailMessage } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { BoardService } from '@/services/board.service';
import { BoardAccountService } from '@/services/board-account.service';
import { BoardColumnService } from '@/services/board-column.service';
import { BoardMemberService } from '@/services/board-member.service';
import { DomainService } from '@/services/domain.service';
import { EmailDraftService } from '@/services/email-draft.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { SenderEmailAddressService } from '@/services/sender-email-address.service';
import { GmailApi, LABEL } from '@/utils/gmail-api';
import { unique } from '@/utils/lists';
import { orm } from '@/utils/orm';
import { FALLBACK_SUBJECT, type Participant } from '@/utils/shared';
import { msAgoFrom } from '@/utils/time';

export class BoardCardService {
  static async findCardsByExternalThreadIds<Hint extends string = never>({
    gmailAccount,
    externalThreadIds,
    populate = [],
  }: {
    gmailAccount: GmailAccount;
    externalThreadIds: string[];
    populate?: Populate<BoardCard, Hint>;
  }) {
    if (externalThreadIds.length === 0) return [];
    return orm.em.find(
      BoardCard,
      { boardAccount: { gmailAccount }, externalThreadId: { $in: externalThreadIds } },
      { populate },
    );
  }

  static async findInboxCardsByBoardId<Hint extends string = never>(
    boardId: string,
    { populate = [] }: { populate?: Populate<BoardCard, Hint> } = {},
  ) {
    const boardCardsDesc = await orm.em.find(
      BoardCard,
      { state: State.INBOX, boardColumn: { board: { id: boardId } } },
      { populate, orderBy: { lastEventAt: 'DESC' } },
    );
    return { boardCardsDesc };
  }

  static async findById<Hint extends string = never>(
    board: Loaded<Board>,
    { boardCardId, populate = [] }: { boardCardId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardCard, { id: boardCardId, boardColumn: { board: { id: board.id } } }, { populate });
  }

  static async findByBoardAccount<Hint extends string = never>({
    boardAccount,
    populate = [],
  }: {
    boardAccount: BoardAccount;
    populate?: Populate<BoardCard, Hint>;
  }) {
    return orm.em.find(BoardCard, { boardAccount }, { populate });
  }

  static async findByBoard<Hint extends string = never>({
    board,
    populate = [],
  }: {
    board: Board;
    populate?: Populate<BoardCard, Hint>;
  }) {
    return orm.em.find(BoardCard, { boardColumn: { board } }, { populate });
  }

  static async populate<Hint extends string = never>(
    boardCard: Loaded<BoardCard>,
    populate: readonly AutoPath<BoardCard, Hint, PopulatePath.ALL>[],
  ) {
    await orm.em.populate(boardCard, populate);
    return boardCard as Loaded<BoardCard, Hint>;
  }

  static async createWithEmailDraft(
    board: Loaded<Board>,
    { user, boardAccountId }: { user: Loaded<User, 'boardMembers'>; boardAccountId: string },
  ) {
    const boardAccount = await BoardAccountService.findById(board, {
      id: boardAccountId,
      populate: ['gmailAccount.senderEmailAddresses'],
    });
    const { senderEmailAddresses } = boardAccount.loadedGmailAccount;
    if (senderEmailAddresses.length === 0) {
      throw new Error('No sender email addresses available for this board');
    }
    const fromParticipant = SenderEmailAddressService.toParticipant(senderEmailAddresses[0]!);

    const domainName = fromParticipant.email.split('@')[1]!;
    let domain = await DomainService.tryFindByName(domainName);
    if (!domain) {
      domain = new Domain({ name: domainName });
      await DomainService.fetchIcon(domain);
      orm.em.persist(domain);
    }

    await BoardService.populate(board, ['boardColumns']);
    const firstBoardColumn = [...board.boardColumns].sort((a, b) => a.position - b.position)[0]!;

    const boardCard = new BoardCard({
      boardAccount,
      boardColumn: firstBoardColumn,
      domain,
      state: State.INBOX,
      subject: FALLBACK_SUBJECT,
      snippet: '',
      participantsAsc: [fromParticipant],
      lastEventAt: new Date(),
      hasAttachments: false,
      emailMessageCount: 0,
      participantUserIds: [user.id],
    });

    const boardMember = user.boardMembers.find((bm) => bm.board.id === board.id)!;
    boardCard.assignToBoardMember(boardMember);

    for (const member of board.boardMembers) {
      if (member.isAgent) continue;
      const lastReadAt = member.id === boardMember.id ? boardCard.lastEventAt : msAgoFrom(boardCard.lastEventAt);
      boardCard.boardCardReadPositions.add(new BoardCardReadPosition({ boardCard, user: member.user, lastReadAt }));
    }

    boardCard.emailDraft = new EmailDraft({
      boardCard,
      lastEditedByUser: user,
      generated: false,
      from: fromParticipant,
      to: undefined,
      cc: undefined,
      bcc: undefined,
      subject: boardCard.subject,
      bodyHtml: '',
    });

    orm.em.persist([boardCard, boardCard.emailDraft]);

    await orm.em.flush();
    return boardCard as Loaded<BoardCard, 'emailDraft.fileAttachments' | 'domain' | 'boardCardReadPositions'>;
  }

  static async markAsRead<Hint extends string = never>(
    board: Board,
    { boardCardId, populate }: { boardCardId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, {
      boardCardId,
      populate: ['boardAccount.gmailAccount', 'boardCardReadPositions', ...(populate || [])] as Populate<
        BoardCard,
        Hint
      >,
    });

    for (const boardCardReadPosition of boardCard.boardCardReadPositions) {
      boardCardReadPosition.setLastReadAt(boardCard.lastEventAt);
      orm.em.persist(boardCardReadPosition);
    }

    if (board.solo && boardCard.externalThreadId) {
      console.log('[GMAIL] Marking thread as read:', boardCard.externalThreadId);
      const gmail = await GmailAccountService.initGmail(boardCard.loadedBoardAccount.loadedGmailAccount);
      await GmailApi.markThreadAsRead(gmail, boardCard.externalThreadId);
    }
    await orm.em.flush();

    return boardCard;
  }

  static async markAsUnread<Hint extends string = never>(
    board: Board,
    { boardCardId, populate }: { boardCardId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, {
      boardCardId,
      populate: ['boardAccount.gmailAccount', ...(populate || [])] as Populate<BoardCard, Hint>,
    });

    for (const boardCardReadPosition of boardCard.boardCardReadPositions) {
      boardCardReadPosition.setLastReadAt(msAgoFrom(boardCard.lastEventAt));
      orm.em.persist(boardCardReadPosition);
    }

    if (board.solo && boardCard.externalThreadId) {
      console.log('[GMAIL] Marking thread as unread:', boardCard.externalThreadId);
      const gmail = await GmailAccountService.initGmail(boardCard.loadedBoardAccount.loadedGmailAccount);
      await GmailApi.markThreadAsUnread(gmail, boardCard.externalThreadId);
    }
    await orm.em.flush();

    return boardCard;
  }

  static async setBoardColumn<Hint extends string = never>(
    board: Board,
    {
      boardCardId,
      boardColumnId,
      populate,
    }: { boardCardId: string; boardColumnId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, { boardCardId, populate });
    const boardColumn = await BoardColumnService.findById(boardColumnId, { board });

    boardCard.setBoardColumn(boardColumn);
    await orm.em.flush();

    return boardCard;
  }

  static async setState<Hint extends string = never>(
    board: Board,
    { boardCardId, state, populate }: { boardCardId: string; state: State; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, {
      boardCardId,
      populate: ['boardAccount.gmailAccount', 'emailDraft.fileAttachments', ...(populate || [])] as Populate<
        BoardCard,
        Hint
      >,
    });

    boardCard.setState(state);

    if (state === State.ARCHIVED) {
      if (board.solo && boardCard.externalThreadId) {
        console.log('[GMAIL] Marking thread as read (archived):', boardCard.externalThreadId);
        const gmail = await GmailAccountService.initGmail(boardCard.loadedBoardAccount.loadedGmailAccount);
        await GmailApi.markThreadAsRead(gmail, boardCard.externalThreadId);
      }
      await EmailDraftService.delete(boardCard as Loaded<BoardCard, 'emailDraft.fileAttachments'>);
    } else if (state === State.TRASH) {
      if (board.solo && boardCard.externalThreadId) {
        const gmail = await GmailAccountService.initGmail(boardCard.loadedBoardAccount.loadedGmailAccount);
        console.log('[GMAIL] Marking thread as trash:', boardCard.externalThreadId);
        await GmailApi.markThreadAsTrash(gmail, boardCard.externalThreadId);
      }
      await EmailDraftService.delete(boardCard as Loaded<BoardCard, 'emailDraft.fileAttachments'>);
    } else if (state === State.SPAM && boardCard.externalThreadId) {
      if (board.solo && boardCard.externalThreadId) {
        console.log('[GMAIL] Marking thread as spam:', boardCard.externalThreadId);
        const gmail = await GmailAccountService.initGmail(boardCard.loadedBoardAccount.loadedGmailAccount);
        await GmailApi.markThreadAsSpam(gmail, boardCard.externalThreadId);
      }
      await EmailDraftService.delete(boardCard as Loaded<BoardCard, 'emailDraft.fileAttachments'>);
    }

    await orm.em.flush();

    return boardCard;
  }

  static async setAssignee<Hint extends string = never>(
    board: Board,
    {
      boardCardId,
      boardMemberId,
      populate,
    }: { boardCardId: string; boardMemberId: string | null; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, { boardCardId, populate });

    if (boardMemberId) {
      const boardMember = await BoardMemberService.findById(board, { boardMemberId });
      boardCard.assignToBoardMember(boardMember);
    } else {
      boardCard.unassignBoardMember();
    }
    orm.em.persist(boardCard);

    await orm.em.flush();

    return boardCard;
  }

  static async setSubject<Hint extends string = never>(
    board: Board,
    { boardCardId, subject, populate }: { boardCardId: string; subject: string; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, { boardCardId, populate });

    if (boardCard.noMessages) {
      boardCard.setSubject(subject);
      orm.em.persist(boardCard);
      await orm.em.flush();
    }

    return boardCard;
  }

  static buildFromEmailMessages({
    boardColumn,
    boardAccount,
    emailMessagesDesc,
  }: {
    boardColumn: BoardColumn;
    boardAccount: BoardAccount;
    emailMessagesDesc: Loaded<EmailMessage, 'gmailAttachments' | 'gmailAccount'>[];
  }) {
    if (emailMessagesDesc.length === 0) throw new Error('Cannot build BoardCard from empty email messages list');

    const board = boardColumn.loadedBoard;
    const state = board.solo ? BoardCardService.stateFromEmailMessages(emailMessagesDesc) : State.INBOX;
    const lastEmailMessage = emailMessagesDesc[0]!;
    const firstEmailMessage = emailMessagesDesc[emailMessagesDesc.length - 1]!;
    const lastEventAt = lastEmailMessage.externalCreatedAt;

    const participantUserIds = unique(emailMessagesDesc.map((msg) => msg.loadedGmailAccount.user.id));

    const boardCard = new BoardCard({
      boardAccount,
      boardColumn,
      domain: firstEmailMessage.domain,
      externalThreadId: lastEmailMessage.externalThreadId,
      state,
      subject: firstEmailMessage.subject,
      snippet: lastEmailMessage.snippet,
      participantsAsc: BoardCardService.participantsAsc({ emailMessagesDesc }),
      lastEventAt,
      hasAttachments: emailMessagesDesc.some((msg) => msg.gmailAttachments.length > 0),
      emailMessageCount: emailMessagesDesc.length,
      movedToTrashAt: state === State.TRASH ? new Date() : undefined,
      participantUserIds: participantUserIds.length > 0 ? participantUserIds : undefined,
    });

    let lastReadAt: Date;
    if (board.solo) {
      // Solo: inherit unread status from gmail
      const firstUnreadEmailMessage = emailMessagesDesc.toReversed().find((m) => m.labels.includes(LABEL.UNREAD));
      lastReadAt = firstUnreadEmailMessage ? msAgoFrom(firstUnreadEmailMessage.externalCreatedAt) : lastEventAt;
    } else {
      // Multi-member: always mark as unread
      lastReadAt = msAgoFrom(lastEventAt);
    }
    for (const boardMember of board.boardMembers) {
      if (boardMember.isAgent) continue;

      boardCard.boardCardReadPositions.add(
        new BoardCardReadPosition({ boardCard, user: boardMember.user, lastReadAt }),
      );
    }

    return boardCard;
  }

  // Returns originally passed boardCard type
  static rebuildFromEmailMessages({
    boardCard,
    emailMessagesDesc,
  }: {
    boardCard: Loaded<BoardCard, 'boardColumn' | 'boardCardReadPositions' | 'comments' | 'emailDraft'>;
    emailMessagesDesc: Loaded<EmailMessage, 'gmailAttachments' | 'gmailAccount'>[];
  }) {
    if (emailMessagesDesc.length === 0) throw new Error('Cannot build BoardCard from empty email messages list');

    const board = boardCard.loadedBoardColumn.loadedBoard;
    const lastEmailMessage = emailMessagesDesc[0]!;
    const lastEventAt = lastEmailMessage.externalCreatedAt;

    let state: State;
    if (board.solo) {
      // Solo: inherit unread status from gmail
      const firstUnreadEmailMessage = emailMessagesDesc.toReversed().find((m) => m.labels.includes(LABEL.UNREAD));
      const lastReadAt = firstUnreadEmailMessage ? msAgoFrom(firstUnreadEmailMessage.externalCreatedAt) : lastEventAt;
      for (const boardCardReadPosition of boardCard.boardCardReadPositions) {
        boardCardReadPosition.setLastReadAt(lastReadAt);
      }

      state = BoardCardService.stateFromEmailMessages(emailMessagesDesc);
      if (boardCard.state === State.ARCHIVED && state === State.INBOX && !firstUnreadEmailMessage) {
        state = State.ARCHIVED; // If archived and no new email arrived, keep archived
      }
    } else {
      // Multi-member: do not change read positions

      state = boardCard.state;
      if (state === State.ARCHIVED && boardCard.emailMessageCount < emailMessagesDesc.length) {
        state = State.INBOX; // If archived but a new email arrived, move back to inbox
      }
    }

    const participantUserIds = unique(
      [
        ...emailMessagesDesc.map((msg) => msg.loadedGmailAccount.user.id),
        ...boardCard.comments.map((c) => c.user.id),
        boardCard.emailDraft?.lastEditedByUser.id,
      ].filter((id): id is string => !!id),
    );

    boardCard.setState(state);

    boardCard.update({
      snippet: lastEmailMessage.snippet,
      externalThreadId: lastEmailMessage.externalThreadId,
      participantsAsc: BoardCardService.participantsAsc({ emailMessagesDesc }),
      lastEventAt,
      hasAttachments: emailMessagesDesc.some((msg) => msg.gmailAttachments.length > 0),
      emailMessageCount: emailMessagesDesc.length,
      participantUserIds: participantUserIds.length > 0 ? participantUserIds : undefined,
    });

    return boardCard;
  }

  static async deleteAfterDeletingEmailDrafts(boardCard: Loaded<BoardCard>) {
    await orm.em.transactional(async (em) => {
      await em.nativeDelete(Comment, { boardCard });
      await em.nativeDelete(BoardCardReadPosition, { boardCard });
      await em.nativeDelete(BoardCard, { id: boardCard.id });
    });
  }

  // Unique by email
  private static participantsAsc({ emailMessagesDesc }: { emailMessagesDesc: EmailMessage[] }) {
    const participantsAsc = emailMessagesDesc
      .toReversed()
      .flatMap((emailMessage) => [
        emailMessage.from,
        ...(emailMessage.to || []),
        ...(emailMessage.cc || []),
        ...(emailMessage.bcc || []),
      ]);

    const uniqueParticipants: Participant[] = [];
    const seenEmails = new Set<string>();
    for (const participant of participantsAsc) {
      if (!seenEmails.has(participant.email)) {
        uniqueParticipants.push(participant);
        seenEmails.add(participant.email);
      }
    }

    return uniqueParticipants;
  }

  private static stateFromEmailMessages(emailMessages: EmailMessage[]) {
    if (emailMessages.every((msg) => msg.labels.includes(LABEL.SPAM))) {
      return State.SPAM;
    } else if (emailMessages.every((msg) => msg.labels.includes(LABEL.TRASH))) {
      return State.TRASH;
    }
    return State.INBOX;
  }
}
