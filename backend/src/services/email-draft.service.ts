import * as cheerio from 'cheerio';
import type { Board } from '@/entities/board';
import { Domain } from '@/entities/domain';
import { EmailDraft, type Participant } from '@/entities/email-draft';
import { EmailMessage } from '@/entities/email-message';
import { BoardCardService } from '@/services/board-card.service';
import { DomainService } from '@/services/domain.service';
import { EmailMessageService } from '@/services/email-message.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { GmailApi, LABEL, MAX_SNIPPET_LENGTH } from '@/utils/gmail-api';
import { presence } from '@/utils/lists';
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

    const fromParticipant = EmailMessageService.parseParticipant(from)!;
    const toParticipants = to?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const ccParticipants = cc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);
    const bccParticipants = bcc?.map(EmailMessageService.parseParticipant).filter((p): p is Participant => !!p);

    const emailMessagesDesc = await EmailMessageService.findEmailMessageByBoardCard(boardCard, {
      populate: ['attachments'],
      orderBy: { externalCreatedAt: 'DESC' },
    });
    const domainName = fromParticipant.email.split('@')[1]!;
    let domain = await DomainService.tryFindByName(domainName);
    if (!domain) {
      domain = new Domain({ name: domainName });
      await DomainService.fetchIcon(domain);
    }

    const $ = cheerio.load(bodyHtml || '');
    const bodyText = $.text();

    const gmail = await GmailAccountService.initGmail(boardCard.gmailAccount);
    const participantToString = (p: Participant) => (p.name ? `${p.name} <${p.email}>` : p.email);

    const sentMessage = await GmailApi.sendEmail(gmail, {
      from: participantToString(fromParticipant),
      to: toParticipants?.map(participantToString),
      cc: ccParticipants?.map(participantToString),
      bcc: bccParticipants?.map(participantToString),
      subject: subject,
      bodyHtml: bodyHtml,
      threadId: boardCard.externalThreadId,
    });

    const emailMessage = new EmailMessage({
      gmailAccount: boardCard.gmailAccount,
      domain,
      externalId: sentMessage.id!,
      externalThreadId: sentMessage.threadId!,
      externalCreatedAt: new Date(),
      from: fromParticipant,
      subject: subject || '(No Subject)',
      snippet: bodyText.substring(0, MAX_SNIPPET_LENGTH) || '',
      sent: true,
      labels: [LABEL.SENT],
      to: presence(toParticipants),
      cc: presence(ccParticipants),
      bcc: presence(bccParticipants),
      bodyText,
      bodyHtml,
    });

    const rebuiltBoardCard = BoardCardService.rebuildFromEmailMessages({
      boardCard,
      gmailAccount: boardCard.gmailAccount,
      emailMessagesDesc: [emailMessage, ...emailMessagesDesc],
    });

    orm.em.persist([domain, emailMessage, rebuiltBoardCard]);
    if (boardCard.emailDraft) {
      orm.em.remove(boardCard.emailDraft);
    }
    await orm.em.flush();

    return { emailMessage, boardCard: rebuiltBoardCard };
  }
}
