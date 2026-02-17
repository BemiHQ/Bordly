import type { Board } from '@/entities/board';
import { EmailDraft, type Participant } from '@/entities/email-draft';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { EmailMessageService } from '@/services/email-message.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi } from '@/utils/gmail-api';
import { orm } from '@/utils/orm';

export class EmailDraftService {
  static async upsert(
    board: Board,
    {
      boardCardId,
      generated,
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
    }: {
      boardCardId: string;
      generated: boolean;
      from: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
    },
  ): Promise<EmailDraft> {
    const boardCard = await BoardCardService.findById(board, { boardCardId, populate: ['gmailAccount', 'emailDraft'] });

    const fromParticipant = EmailMessageService.parseParticipant(from)!;
    const toParticipants = to?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const ccParticipants = cc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const bccParticipants = bcc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);

    let emailDraft = boardCard.emailDraft;
    if (emailDraft) {
      emailDraft.update({
        generated,
        from: fromParticipant,
        to: toParticipants,
        cc: ccParticipants,
        bcc: bccParticipants,
        subject,
        bodyHtml,
      });
    } else {
      emailDraft = new EmailDraft({
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

    orm.em.persist(emailDraft);
    await orm.em.flush();

    return emailDraft;
  }

  static async delete(board: Board, { boardCardId }: { boardCardId: string }) {
    const boardCard = await BoardCardService.findById(board, { boardCardId, populate: ['emailDraft'] });

    if (boardCard.emailDraft) {
      orm.em.remove(boardCard.emailDraft);
      await orm.em.flush();
    }
  }

  static async send(
    board: Board,
    {
      boardCardId,
      from,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
    }: {
      boardCardId: string;
      from: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      bodyHtml?: string;
    },
  ) {
    const boardCard = await BoardCardService.findById(board, {
      boardCardId,
      populate: ['emailDraft', 'gmailAccount.emailAddresses', 'domain'],
    });

    const emailMessagesDesc = await EmailMessageService.findEmailMessageByBoardCard(boardCard, {
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
    });

    const messageData = await GmailApi.getMessage(gmail, sentMessage.id!);
    const emailMessage = EmailMessageService.parseEmailMessage({ gmailAccount, messageData });
    if (domain) {
      emailMessage.domain = domain;
    } else {
      await DomainService.fetchIcon(emailMessage.domain);
      orm.em.persist(emailMessage.domain);
    }

    const rebuiltBoardCard = BoardCardService.rebuildFromEmailMessages({
      boardCard,
      gmailAccount,
      emailMessagesDesc: [emailMessage, ...emailMessagesDesc],
    });

    orm.em.persist([emailMessage, rebuiltBoardCard]);
    if (boardCard.emailDraft) {
      orm.em.remove(boardCard.emailDraft);
    }
    await orm.em.flush();

    return { emailMessage, boardCard: rebuiltBoardCard };
  }
}
