import type { Board } from '@/entities/board';
import { EmailDraft, type Participant } from '@/entities/email-draft';
import { BoardCardService } from '@/services/board-card.service';
import { EmailMessageService } from '@/services/email-message.service';
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
}
