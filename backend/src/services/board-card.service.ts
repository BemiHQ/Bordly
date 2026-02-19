import type { Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import { BoardCard, State } from '@/entities/board-card';
import { BoardCardReadPosition } from '@/entities/board-card-read-position';
import type { BoardColumn } from '@/entities/board-column';
import type { EmailMessage, Participant } from '@/entities/email-message';
import type { GmailAccount } from '@/entities/gmail-account';
import { BoardColumnService } from '@/services/board-column.service';
import { BoardMemberService } from '@/services/board-member.service';
import { EmailDraftService } from '@/services/email-draft.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi, LABEL } from '@/utils/gmail-api';
import { orm } from '@/utils/orm';
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
    return orm.em.find(BoardCard, { gmailAccount, externalThreadId: { $in: externalThreadIds } }, { populate });
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
    board: Board,
    { boardCardId, populate = [] }: { boardCardId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardCard, { id: boardCardId, boardColumn: { board: { id: board.id } } }, { populate });
  }

  static async findByBoardAndGmailAccount<Hint extends string = never>({
    board,
    gmailAccount,
    populate = [],
  }: {
    board: Board;
    gmailAccount: GmailAccount;
    populate?: Populate<BoardCard, Hint>;
  }) {
    return orm.em.find(BoardCard, { gmailAccount, boardColumn: { board } }, { populate });
  }

  static async markAsRead<Hint extends string = never>(
    board: Board,
    { boardCardId, populate }: { boardCardId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(board, {
      boardCardId,
      populate: ['gmailAccount', 'boardCardReadPositions', ...(populate || [])] as Populate<BoardCard, Hint>,
    });

    for (const boardCardReadPosition of boardCard.boardCardReadPositions) {
      boardCardReadPosition.setLastReadAt(boardCard.lastEventAt);
      orm.em.persist(boardCardReadPosition);
    }

    if (board.solo) {
      console.log('[GMAIL] Marking thread as read:', boardCard.externalThreadId);
      const gmail = await GmailAccountService.initGmail(boardCard.loadedGmailAccount);
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
      populate: ['gmailAccount', ...(populate || [])] as Populate<BoardCard, Hint>,
    });

    for (const boardCardReadPosition of boardCard.boardCardReadPositions) {
      boardCardReadPosition.setLastReadAt(msAgoFrom(boardCard.lastEventAt));
      orm.em.persist(boardCardReadPosition);
    }

    if (board.solo) {
      console.log('[GMAIL] Marking thread as unread:', boardCard.externalThreadId);
      const gmail = await GmailAccountService.initGmail(boardCard.loadedGmailAccount);
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
      populate: ['gmailAccount', 'emailDraft.fileAttachments', ...(populate || [])] as Populate<BoardCard, Hint>,
    });

    const gmail = await GmailAccountService.initGmail(boardCard.loadedGmailAccount);

    boardCard.setState(state);

    if (state === State.ARCHIVED) {
      await GmailApi.markThreadAsRead(gmail, boardCard.externalThreadId);
      await EmailDraftService.delete(boardCard);
    } else if (state === State.TRASH) {
      console.log('[GMAIL] Marking thread as trash:', boardCard.externalThreadId);
      await GmailApi.markThreadAsTrash(gmail, boardCard.externalThreadId);
      await EmailDraftService.delete(boardCard);
    } else if (state === State.SPAM) {
      console.log('[GMAIL] Marking thread as spam:', boardCard.externalThreadId);
      await GmailApi.markThreadAsSpam(gmail, boardCard.externalThreadId);
      await EmailDraftService.delete(boardCard);
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

  static buildFromEmailMessages({
    boardColumn,
    gmailAccount,
    emailMessagesDesc,
  }: {
    boardColumn: BoardColumn;
    gmailAccount: GmailAccount;
    emailMessagesDesc: EmailMessage[];
  }) {
    if (emailMessagesDesc.length === 0) throw new Error('Cannot build BoardCard from empty email messages list');

    const board = boardColumn.loadedBoard;
    const state = board.solo ? BoardCardService.stateFromEmailMessages(emailMessagesDesc) : State.INBOX;
    const lastEmailMessage = emailMessagesDesc[0]!;
    const firstEmailMessage = emailMessagesDesc[emailMessagesDesc.length - 1]!;
    const lastEventAt = lastEmailMessage.externalCreatedAt;

    const boardCard = new BoardCard({
      gmailAccount,
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

  static rebuildFromEmailMessages({
    boardCard,
    emailMessagesDesc,
  }: {
    boardCard: BoardCard;
    emailMessagesDesc: EmailMessage[];
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

    boardCard.update({
      state,
      snippet: lastEmailMessage.snippet,
      participantsAsc: BoardCardService.participantsAsc({ emailMessagesDesc }),
      lastEventAt,
      hasAttachments: emailMessagesDesc.some((msg) => msg.gmailAttachments.length > 0),
      emailMessageCount: emailMessagesDesc.length,
      movedToTrashAt: state === State.TRASH ? boardCard.movedToTrashAt || new Date() : undefined,
    });

    return boardCard;
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
