import type { Populate } from '@mikro-orm/postgresql';

import type { Board } from '@/entities/board';
import { BoardCard, State } from '@/entities/board-card';
import type { GmailAccount } from '@/entities/gmail-account';
import { BoardColumnService } from '@/services/board-column.service';
import { EmailMessageService } from '@/services/email-message.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GoogleApi } from '@/utils/google-api';

import { orm } from '@/utils/orm';

export class BoardCardService {
  static async findAndBuildBoardCardByThreadId<Hint extends string = never>(args: {
    gmailAccount: GmailAccount;
    externalThreadIds: string[];
    populate?: Populate<BoardCard, Hint>;
  }) {
    const { gmailAccount, externalThreadIds, populate = [] } = args;
    if (externalThreadIds.length === 0) return {};

    const boardCards = await orm.em.find(
      BoardCard,
      { gmailAccount, externalThreadId: { $in: externalThreadIds } },
      { populate },
    );
    const boardCardByThreadId: Record<string, BoardCard> = {};
    for (const boardCard of boardCards) {
      boardCardByThreadId[boardCard.externalThreadId] = boardCard;
    }
    return boardCardByThreadId;
  }

  static async findCardsByBoard<Hint extends string = never>(
    board: Board,
    { state = State.INBOX, populate = [] }: { state?: State; populate?: Populate<BoardCard, Hint> },
  ) {
    return orm.em.find(BoardCard, { state, boardColumn: { board: { id: board.id } } }, { populate });
  }

  static async findById<Hint extends string = never>(
    boardCardId: string,
    { board, populate = [] }: { board: Board; populate?: Populate<BoardCard, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardCard, { id: boardCardId, boardColumn: { board: { id: board.id } } }, { populate });
  }

  static async markAsRead<Hint extends string = never>(
    board: Board,
    { boardCardId, populate }: { boardCardId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(boardCardId, {
      board,
      populate: ['gmailAccount', ...(populate || [])] as Populate<BoardCard, Hint>,
    });

    const gmail = await BoardCardService.initGmail(boardCard);
    await GoogleApi.gmailMarkThreadAsRead(gmail, boardCard.externalThreadId);

    boardCard.setUnreadEmailMessageIds(undefined);
    await orm.em.flush();

    return boardCard;
  }

  static async markAsUnread<Hint extends string = never>(
    board: Board,
    { boardCardId, populate }: { boardCardId: string; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(boardCardId, {
      board,
      populate: ['gmailAccount', ...(populate || [])] as Populate<BoardCard, Hint>,
    });
    const lastEmailMessage = await EmailMessageService.findLastByExternalThreadId(boardCard.externalThreadId);

    const gmail = await BoardCardService.initGmail(boardCard);
    await GoogleApi.gmailMarkThreadAsUnread(gmail, boardCard.externalThreadId);

    boardCard.setUnreadEmailMessageIds([lastEmailMessage.id]);
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
    const boardCard = await BoardCardService.findById(boardCardId, { board, populate });
    const boardColumn = await BoardColumnService.findById(boardColumnId, { board });

    boardCard.setBoardColumn(boardColumn);
    await orm.em.flush();

    return boardCard;
  }

  static async setState<Hint extends string = never>(
    board: Board,
    { boardCardId, state, populate }: { boardCardId: string; state: State; populate?: Populate<BoardCard, Hint> },
  ) {
    const boardCard = await BoardCardService.findById(boardCardId, {
      board,
      populate: ['gmailAccount', ...(populate || [])] as Populate<BoardCard, Hint>,
    });

    if (state === State.ARCHIVED) {
      const gmail = await BoardCardService.initGmail(boardCard);
      await GoogleApi.gmailMarkThreadAsRead(gmail, boardCard.externalThreadId);
    }

    boardCard.setState(state);
    await orm.em.flush();

    return boardCard;
  }

  static async initGmail(boardCard: BoardCard) {
    const { oauth2Client } = await GmailAccountService.refreshAccessToken(boardCard.gmailAccount);
    return GoogleApi.newGmail(oauth2Client);
  }
}
