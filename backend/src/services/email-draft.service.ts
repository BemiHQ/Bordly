import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import { EmailDraft, type Participant } from '@/entities/email-draft';
import type { User } from '@/entities/user';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { EmailMessageService } from '@/services/email-message.service';
import { FileAttachmentService } from '@/services/file-attachment.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi } from '@/utils/gmail-api';
import { orm } from '@/utils/orm';
import { S3Client } from '@/utils/s3-client';

export class EmailDraftService {
  static async upsert(
    boardCard: BoardCard,
    {
      user,
      generated,
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
    }: {
      user: User;
      generated: boolean;
      from: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
    },
  ) {
    const fromParticipant = EmailMessageService.parseParticipant(from)!;
    const toParticipants = to?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const ccParticipants = cc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const bccParticipants = bcc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);

    if (boardCard.emailDraft) {
      boardCard.emailDraft.update({
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
        boardCard,
        generated,
        from: fromParticipant,
        to: toParticipants,
        cc: ccParticipants,
        bcc: bccParticipants,
        subject,
        bodyHtml,
      });
    }
    boardCard.setLastEventAt(new Date());
    orm.em.persist([boardCard.emailDraft, boardCard]);

    const userBoardCardReadPosition = boardCard.boardCardReadPositions.find((pos) => pos.user.id === user.id)!;
    userBoardCardReadPosition.setLastReadAt(boardCard.lastEventAt);
    orm.em.persist(userBoardCardReadPosition);

    await orm.em.flush();
    return boardCard;
  }

  static async delete(board: Board, { boardCardId }: { boardCardId: string }) {
    const boardCard = await BoardCardService.findById(board, { boardCardId, populate: ['emailDraft.fileAttachments'] });
    const { emailDraft } = boardCard;

    if (emailDraft) {
      orm.em.remove(emailDraft);
      await FileAttachmentService.deleteAllForDraft(emailDraft);
      await orm.em.flush();
    }
  }

  static async send(
    boardCard: BoardCard,
    {
      user,
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
    }: {
      user: User;
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

    const gmailAccount = boardCard.loadedGmailAccount;
    const gmail = await GmailAccountService.initGmail(gmailAccount);

    const attachments = boardCard.emailDraft
      ? await Promise.all(
          boardCard.emailDraft.fileAttachments.map(async (attachment) => {
            const data = await S3Client.getFile({ key: attachment.s3Key });
            return { filename: attachment.filename, mimeType: attachment.mimeType, data };
          }),
        )
      : undefined;

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
      await DomainService.fetchIcon(emailMessage.domain);
      orm.em.persist(emailMessage.domain);
    }
    orm.em.persist(emailMessage);

    const rebuiltBoardCard = BoardCardService.rebuildFromEmailMessages({
      boardCard,
      gmailAccount,
      emailMessagesDesc: [emailMessage, ...emailMessagesDesc],
    });
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
}
