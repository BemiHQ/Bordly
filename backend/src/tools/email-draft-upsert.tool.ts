import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import { z } from 'zod';
import type { User } from '@/entities/user';
import type { Context } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { BoardMemberService } from '@/services/board-member.service';
import { EmailDraftService } from '@/services/email-draft.service';
import { EmailMessageService } from '@/services/email-message.service';
import { SenderEmailAddressService } from '@/services/sender-email-address.service';
import { Logger } from '@/utils/logger';
import { createQuotedHtml, participantToString, replyEmailFields } from '@/utils/shared';
import { shortDateTimeWithWeekday } from '@/utils/time';

export const emailDraftUpsertTool = createTool({
  id: 'email-draft-upsert',
  description: 'Insert or update an email draft in HTML format within the board card',
  inputSchema: z.object({
    from: z.string().min(1).describe('Sender email address'),
    to: z.array(z.string().min(1)).min(1).optional().describe('Recipient email addresses'),
    cc: z.array(z.string().min(1)).min(1).optional().describe('CC email addresses'),
    bcc: z.array(z.string().min(1)).min(1).optional().describe('BCC email addresses'),
    mainHtml: z.string().optional().describe('Written email body in HTML format'),
    replyToEmailMessageId: z.uuid().optional().describe('The ID of the email message this draft is replying to'),
  }),
  execute: async (data, context) => {
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const initialBoardCard = requestContext.get('boardCard');
    Logger.info(`[AGENT] Executing email-draft-upsert for board card ${initialBoardCard.id}: ${JSON.stringify(data)}`);

    const userTimeZone = requestContext.get('userTimeZone');
    const userBoardMember = requestContext.get('userBoardMember');
    const bordlyBoardMember = requestContext.get('bordlyBoardMember');

    await BoardMemberService.populate(userBoardMember, ['user.boardMembers']);
    const user = userBoardMember.loadedUser as Loaded<User, 'boardMembers'>;

    const boardCard = await BoardCardService.populate(initialBoardCard, ['boardCardReadPositions', 'boardAccount']);

    const replyToEmailMessage = data.replyToEmailMessageId
      ? await EmailMessageService.findById(boardCard, { id: data.replyToEmailMessageId })
      : boardCard.externalThreadId
        ? await EmailMessageService.findLastByExternalThreadId(boardCard.externalThreadId)
        : undefined;

    let { from, to, cc, bcc } = data;

    let quotedEmailHtml = '';
    if (replyToEmailMessage) {
      quotedEmailHtml = createQuotedHtml({
        from: replyToEmailMessage.from,
        sentAt: shortDateTimeWithWeekday(replyToEmailMessage.externalCreatedAt, { timeZone: userTimeZone }),
        html: replyToEmailMessage.bodyHtml || '',
        text: replyToEmailMessage.bodyText || '',
      });

      const senderEmailAddresses = await SenderEmailAddressService.findAddressesByBoardAccountAndUser(
        boardCard.loadedBoardAccount.board,
        { user, boardAccountId: boardCard.boardAccount.id },
      );

      const emailFields = replyEmailFields({
        replyToMessage: replyToEmailMessage,
        senderEmailAddresses: [...senderEmailAddresses],
      });

      from = participantToString(emailFields.from);
      to = emailFields.to?.map(participantToString);
      cc = emailFields.cc?.map(participantToString);
    }

    await EmailDraftService.upsert(boardCard, {
      user,
      generated: false,
      subject: boardCard.noMessages ? boardCard.subject : `Re: ${boardCard.subject}`,
      from,
      to,
      cc,
      bcc,
      bodyHtml: `${data.mainHtml}${quotedEmailHtml}`,
      lastEditedByUser: bordlyBoardMember.user,
    });

    requestContext.set('boardCard', boardCard as unknown as typeof initialBoardCard);
    return { success: true };
  },
});
