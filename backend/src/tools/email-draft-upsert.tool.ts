import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import { z } from 'zod';
import type { BoardCard } from '@/entities/board-card';
import type { User } from '@/entities/user';
import type { Context } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { BoardMemberService } from '@/services/board-member.service';
import { EmailDraftService } from '@/services/email-draft.service';
import { EmailMessageService } from '@/services/email-message.service';
import { createQuotedHtml } from '@/utils/shared';
import { shortDateTimeWithWeekday } from '@/utils/time';

export const emailDraftUpsertTool = createTool({
  id: 'email-draft-upsert',
  description: 'Insert or update an email draft within a board card',
  inputSchema: z.object({
    boardCardId: z.uuid().describe('The ID of the board card'),
    subject: z.string().describe('Email subject line'),
    from: z.string().min(1).describe('Sender email address'),
    to: z.array(z.string().min(1)).min(1).optional().describe('Recipient email addresses'),
    cc: z.array(z.string().min(1)).min(1).optional().describe('CC email addresses'),
    bcc: z.array(z.string().min(1)).min(1).optional().describe('BCC email addresses'),
    mainHtml: z.string().optional().describe('Written email body in HTML format'),
    replyToEmailMessageId: z.uuid().optional().describe('The ID of the email message this draft is replying to'),
  }),
  execute: async (data, context) => {
    console.log(`[AGENT] Executing email-draft-upsert for board card ${data.boardCardId}: ${JSON.stringify(data)}`);
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const bordlyBoardMember = requestContext.get('bordlyBoardMember');
    const userTimeZone = requestContext.get('userTimeZone');
    if (!bordlyBoardMember) throw new Error('Board member context is required');

    await BoardMemberService.populate(bordlyBoardMember, ['user.boardMembers']);
    const user = bordlyBoardMember.loadedUser as Loaded<User, 'boardMembers'>;

    const boardCard = await BoardCardService.findById(bordlyBoardMember.board, {
      boardCardId: data.boardCardId,
      populate: ['emailDraft', 'boardColumn', 'boardCardReadPositions'],
    });

    const quotedEmailHtml = await quotedHtml({
      boardCard,
      userTimeZone,
      replyToEmailMessageId: data.replyToEmailMessageId,
    });

    await EmailDraftService.upsert(boardCard, {
      user,
      generated: false,
      subject: data.subject,
      from: data.from,
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      bodyHtml: `${data.mainHtml}${quotedEmailHtml}`,
    });

    return { success: true };
  },
});

const quotedHtml = async ({
  boardCard,
  userTimeZone,
  replyToEmailMessageId,
}: {
  boardCard: Loaded<BoardCard>;
  userTimeZone?: string;
  replyToEmailMessageId?: string;
}) => {
  if (replyToEmailMessageId) {
    const replyToEmailMessage = await EmailMessageService.findById(boardCard, { id: replyToEmailMessageId });
    return createQuotedHtml({
      from: replyToEmailMessage.from,
      sentAt: shortDateTimeWithWeekday(replyToEmailMessage.externalCreatedAt, { timeZone: userTimeZone }),
      html: replyToEmailMessage.bodyHtml || '',
      text: replyToEmailMessage.bodyText || '',
    });
  }
  return '';
};
