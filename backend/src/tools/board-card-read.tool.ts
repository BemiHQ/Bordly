import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { BoardCard } from '@/entities/board-card';
import { Comment } from '@/entities/comment';
import { EmailDraft } from '@/entities/email-draft';
import { EmailMessage } from '@/entities/email-message';
import type { Context } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { CommentService } from '@/services/comment.service';
import { EmailMessageService } from '@/services/email-message.service';

export const boardCardReadTool = createTool({
  id: 'board-card-read',
  description: 'Read board card with email messages, an email draft, and comments',
  inputSchema: z.object({
    boardCardId: z.uuid().describe('The ID of the board card to read'),
  }),
  execute: async ({ boardCardId }, context) => {
    console.log(`[AGENT] Executing board-card-read for board card ${boardCardId}`);
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const bordlyBoardMember = requestContext.get('bordlyBoardMember');

    const boardCard = await BoardCardService.findById(bordlyBoardMember.board, {
      boardCardId,
      populate: ['assignedBoardMember.user', 'boardColumn', 'emailDraft.fileAttachments'],
    });

    const emailMessagesAsc = await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
      populate: ['domain', 'gmailAttachments'],
      orderBy: { externalCreatedAt: 'ASC' },
    });

    const comments = await CommentService.findCommentsByBoardCard(boardCard, {
      populate: ['user'],
      orderBy: { createdAt: 'ASC' },
    });

    return {
      boardCard: BoardCard.toText(boardCard),
      emailDraft: boardCard.emailDraft && EmailDraft.toText(boardCard.emailDraft),
      emailMessagesAsc: emailMessagesAsc.map(EmailMessage.toText),
      commentsAsc: comments.map(Comment.toText),
    };
  },
});
