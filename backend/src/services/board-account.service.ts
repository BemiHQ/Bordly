import type { Loaded, Populate } from '@mikro-orm/postgresql';
import { Board } from '@/entities/board';
import { BoardAccount } from '@/entities/board-account';
import { BoardCard } from '@/entities/board-card';
import { BoardCardReadPosition } from '@/entities/board-card-read-position';
import { BoardColumn } from '@/entities/board-column';
import { BoardInvite } from '@/entities/board-invite';
import { BoardMember } from '@/entities/board-member';
import { Comment } from '@/entities/comment';
import { EmailDraft } from '@/entities/email-draft';
import { EmailMessage } from '@/entities/email-message';
import { FileAttachment } from '@/entities/file-attachment';
import { GmailAttachment } from '@/entities/gmail-attachment';
import { BoardCardService } from '@/services/board-card.service';
import { EmailDraftService } from '@/services/email-draft.service';
import { orm } from '@/utils/orm';
import { S3Client } from '@/utils/s3-client';

export class BoardAccountService {
  static async findAccountsByBoard<Hint extends string = never>(
    board: Board,
    { populate }: { populate?: Populate<BoardAccount, Hint> } = {},
  ) {
    return orm.em.find(BoardAccount, { board }, { populate });
  }

  static async findById<Hint extends string = never>(
    board: Loaded<Board>,
    { id, populate = [] }: { id: string; populate?: Populate<BoardAccount, Hint> },
  ) {
    return orm.em.findOneOrFail(BoardAccount, { id, board }, { populate });
  }

  static async edit<Hint extends string = never>(
    board: Board,
    {
      boardAccountId,
      receivingEmails,
      populate,
    }: { boardAccountId: string; receivingEmails?: string[]; populate?: Populate<BoardAccount, Hint> },
  ) {
    const boardAccount = await BoardAccountService.findById(board, { id: boardAccountId, populate });

    boardAccount.setReceivingEmails(receivingEmails);
    orm.em.persist(boardAccount);

    await orm.em.flush();
    return boardAccount;
  }

  static async deleteFromBoard(board: Loaded<Board>, { boardAccountId }: { boardAccountId: string }) {
    const boardAccount = await BoardAccountService.findById(board, { id: boardAccountId, populate: ['gmailAccount'] });
    const boardAccountCount = await orm.em.count(BoardAccount, { board });

    const emailDrafts = await EmailDraftService.findDraftsByBoardAccount({
      boardAccount,
      populate: ['fileAttachments'],
    });
    const s3KeysToDelete = emailDrafts.flatMap((d) => d.fileAttachments.map((a) => a.s3Key));
    const boardCards = await BoardCardService.findByBoardAccount({ boardAccount });

    await orm.em.transactional(async (em) => {
      const emailMessagesCondition = {
        externalThreadId: { $in: boardCards.map((c) => c.externalThreadId).filter((id): id is string => !!id) },
      };
      await em.nativeDelete(GmailAttachment, { emailMessage: emailMessagesCondition });
      await em.nativeDelete(EmailMessage, emailMessagesCondition);

      const emailDraftsCondition = { id: { $in: emailDrafts.map((d) => d.id) } };
      await em.nativeDelete(FileAttachment, { emailDraft: emailDraftsCondition });
      await em.nativeDelete(EmailDraft, emailDraftsCondition);

      const boardCardsCondition = { id: { $in: boardCards.map((c) => c.id) } };
      await em.nativeDelete(Comment, { boardCard: boardCardsCondition });
      await em.nativeDelete(BoardCardReadPosition, { boardCard: boardCardsCondition });
      await em.nativeDelete(BoardCard, boardCardsCondition);

      await em.nativeDelete(BoardAccount, { id: boardAccount.id });

      if (boardAccountCount === 1) {
        const boardCondition = { id: board.id };
        await em.nativeDelete(BoardMember, { board: boardCondition });
        await em.nativeDelete(BoardColumn, { board: boardCondition });
        await em.nativeDelete(BoardInvite, { board: boardCondition });
        await em.nativeDelete(Board, boardCondition);
      }

      await S3Client.deleteFiles({ keys: s3KeysToDelete });
    });
  }
}
