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
import { Logger } from '@/utils/logger';

export const boardCardReadTool = createTool({
  id: 'board-card-read',
  description: 'Read board card with email messages, an email draft, and comments',
  inputSchema: z.object({
    boardCardId: z.uuid().describe('The ID of the board card to read'),
  }),
  execute: async ({ boardCardId }, context) => {
    Logger.info(`[AGENT] Tool board-card-read for board card ${boardCardId}`);
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const bordlyBoardMember = requestContext.get('bordlyBoardMember');

    const boardCard = await BoardCardService.findById(bordlyBoardMember.board, {
      boardCardId,
      populate: ['assignedBoardMember.user', 'boardColumn', 'emailDraft.fileAttachments'],
    });

    const [lastEmailMessage] = await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
      populate: ['domain', 'gmailAttachments'],
      orderBy: { externalCreatedAt: 'DESC' },
      limit: 1,
    });

    const comments = await CommentService.findCommentsByBoardCard(boardCard, {
      populate: ['user'],
      orderBy: { createdAt: 'ASC' },
    });

    const result = {
      boardCard: BoardCard.toText(boardCard),
      emailDraft: boardCard.emailDraft && EmailDraft.toText(boardCard.emailDraft),
      lastEmailMessage: lastEmailMessage && EmailMessage.toText(lastEmailMessage),
      commentsAsc: comments.map(Comment.toText),
    };

    Logger.log(result.boardCard);
    if (result.emailDraft) Logger.log(result.emailDraft);
    if (result.lastEmailMessage) Logger.log(result.lastEmailMessage);
    Logger.logObjects(result.commentsAsc);

    return result;
  },
});
