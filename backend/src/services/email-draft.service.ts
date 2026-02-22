import type { Loaded, Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import { EmailDraft, type Participant } from '@/entities/email-draft';
import type { GmailAccount } from '@/entities/gmail-account';
import type { User } from '@/entities/user';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { EmailMessageService } from '@/services/email-message.service';
import { FileAttachmentService } from '@/services/file-attachment.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { SenderEmailAddressService } from '@/services/sender-email-address.service';
import { GmailApi } from '@/utils/gmail-api';
import { orm } from '@/utils/orm';
import { S3Client } from '@/utils/s3-client';

export class EmailDraftService {
  static async findDraftsByBoardAndGmailAccount<Hint extends string = never>({
    board,
    gmailAccount,
    populate,
  }: {
    board: Board;
    gmailAccount: GmailAccount;
    populate?: Populate<EmailDraft, Hint>;
  }) {
    return orm.em.find(EmailDraft, { boardCard: { gmailAccount, boardColumn: { board } } }, { populate });
  }

  static async upsert(
    boardCard: Loaded<BoardCard, 'emailDraft' | 'boardColumn' | 'boardCardReadPositions'>,
    {
      user,
      generated,
      subject,
      from,
      to,
      cc,
      bcc,
      bodyHtml,
    }: {
      user: Loaded<User, 'boardMembers'>;
      generated: boolean;
      subject: string;
      from: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      bodyHtml?: string;
    },
  ) {
    const {
      boardColumn: { board },
    } = boardCard;

    const fromParticipant = EmailMessageService.parseParticipant(from)!;
    const toParticipants = to?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const ccParticipants = cc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const bccParticipants = bcc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);

    const gmailAccount = await EmailDraftService.gmailAccountFromFromParticipant({ board, fromParticipant, user });
    if (!gmailAccount) {
      throw new Error(`No Gmail account found for sender email ${fromParticipant.email} on board ${board.id}`);
    }

    if (boardCard.emailDraft) {
      boardCard.emailDraft.update({
        gmailAccount,
        generated,
        from: fromParticipant,
        to: toParticipants,
        cc: ccParticipants,
        bcc: bccParticipants,
        subject,
        bodyHtml,
      });
    } else {
      boardCard.emailDraft = new EmailDraft({
        gmailAccount,
        boardCard,
        generated,
        from: fromParticipant,
        to: toParticipants,
        cc: ccParticipants,
        bcc: bccParticipants,
        subject,
        bodyHtml,
      });

      if (!boardCard.assignedBoardMember) {
        const boardMember = user.boardMembers.find((bm) => bm.board.id === boardCard.loadedBoardColumn.board.id)!;
        boardCard.assignToBoardMember(boardMember);
      }
      boardCard.addParticipantUserId(gmailAccount.user.id);
    }
    boardCard.setLastEventAt(boardCard.emailDraft.createdAt);
    orm.em.persist([boardCard.emailDraft, boardCard]);

    const userBoardCardReadPosition = boardCard.boardCardReadPositions.find((pos) => pos.user.id === user.id)!;
    userBoardCardReadPosition.setLastReadAt(boardCard.lastEventAt);
    orm.em.persist(userBoardCardReadPosition);

    await orm.em.flush();
    return boardCard;
  }

  static async delete(boardCard: Loaded<BoardCard, 'emailDraft.fileAttachments'>) {
    const { emailDraft } = boardCard;
    if (!emailDraft) return;

    orm.em.remove(emailDraft);
    await FileAttachmentService.deleteAllForDraft(emailDraft);

    if (boardCard.noMessages) {
      await BoardCardService.delete(boardCard);
    }

    await orm.em.flush();
  }

  // Returns originally passed { boardCard } type
  static async send(
    boardCard: Loaded<
      BoardCard,
      | 'gmailAccount'
      | 'emailDraft.fileAttachments'
      | 'emailDraft.gmailAccount'
      | 'boardColumn'
      | 'boardCardReadPositions'
      | 'comments'
    >,
    {
      user,
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
    }: {
      user: Loaded<User>;
      from: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
    },
  ) {
    const emailMessagesDesc = await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
      populate: ['gmailAttachments'],
      orderBy: { externalCreatedAt: 'DESC' },
    });
    const lastEmailMessage = emailMessagesDesc[0];

    const fromParticipant = EmailMessageService.parseParticipant(from)!;
    const toParticipants = to?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const ccParticipants = cc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const bccParticipants = bcc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const participantToString = (p: Participant) => (p.name ? `${p.name} <${p.email}>` : p.email);

    const domainName = fromParticipant.email.split('@')[1]!;
    const domain = await DomainService.tryFindByName(domainName);

    const attachments = boardCard.emailDraft
      ? await Promise.all(
          boardCard.emailDraft.fileAttachments.map(async (attachment) => {
            const data = await S3Client.getFile({ key: attachment.s3Key });
            return { filename: attachment.filename, mimeType: attachment.mimeType, data };
          }),
        )
      : undefined;

    const board = boardCard.loadedBoardColumn.board;
    const gmailAccount = await EmailDraftService.gmailAccountFromFromParticipant({ board, fromParticipant, user });
    if (!gmailAccount) {
      throw new Error(`No Gmail account found for sender email ${fromParticipant.email} on board ${board.id}`);
    }

    const gmail = await GmailAccountService.initGmail(gmailAccount);

    const sentMessage = await GmailApi.sendEmail(gmail, {
      from: participantToString(fromParticipant),
      to: toParticipants?.map(participantToString),
      cc: ccParticipants?.map(participantToString),
      bcc: bccParticipants?.map(participantToString),
      subject: subject,
      bodyHtml: bodyHtml,
      threadId: boardCard.externalThreadId,
      inReplyTo: lastEmailMessage?.messageId,
      references: lastEmailMessage
        ? [lastEmailMessage.references, lastEmailMessage.messageId].filter(Boolean).join(' ')
        : undefined,
      attachments,
    });

    const messageData = await GmailApi.getMessage(gmail, sentMessage.id!);
    const emailMessage = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
    if (domain) {
      emailMessage.domain = domain;
    } else {
      await DomainService.fetchIcon(emailMessage.loadedDomain);
      orm.em.persist(emailMessage.domain);
    }
    orm.em.persist(emailMessage);

    const rebuiltBoardCard = BoardCardService.rebuildFromEmailMessages({
      boardCard,
      emailMessagesDesc: [emailMessage, ...emailMessagesDesc],
    }) as typeof boardCard;
    orm.em.persist(rebuiltBoardCard);

    const userBoardCardReadPosition = rebuiltBoardCard.boardCardReadPositions.find((pos) => pos.user.id === user.id)!;
    userBoardCardReadPosition.setLastReadAt(rebuiltBoardCard.lastEventAt);
    orm.em.persist(userBoardCardReadPosition);

    if (rebuiltBoardCard.emailDraft) {
      const { emailDraft } = rebuiltBoardCard;
      rebuiltBoardCard.emailDraft = undefined;
      orm.em.remove(emailDraft);

      await FileAttachmentService.deleteAllForDraft(emailDraft);
    }
    await orm.em.flush();

    return { emailMessage, boardCard: rebuiltBoardCard };
  }

  private static async gmailAccountFromFromParticipant({
    board,
    fromParticipant,
    user,
  }: {
    board: Loaded<Board>;
    fromParticipant: Participant;
    user: Loaded<User>;
  }) {
    const senderEmailAddresses = await SenderEmailAddressService.findAddressesByBoard(board, {
      user,
      populate: ['gmailAccount'],
    });

    return senderEmailAddresses.find((addr) => addr.email === fromParticipant.email)?.loadedGmailAccount;
  }
}
