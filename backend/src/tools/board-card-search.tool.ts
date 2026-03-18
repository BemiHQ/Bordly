import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import { z } from 'zod';
import { BoardCard } from '@/entities/board-card';
import { Comment } from '@/entities/comment';
import { EmailDraft } from '@/entities/email-draft';
import { EmailMessage } from '@/entities/email-message';
import { GmailAttachment } from '@/entities/gmail-attachment';
import type { Context } from '@/services/agent.service';
import { ArchiveService } from '@/services/archive.service';
import { BoardCardService } from '@/services/board-card.service';
import { EmailMessageService } from '@/services/email-message.service';
import { IndexService } from '@/services/index.service';
import { unique } from '@/utils/lists';
import { Logger } from '@/utils/logger';

const LIMIT = 2;

export const boardCardSearchTool = createTool({
  id: 'board-card-search',
  description: 'Find a relevant board card using semantic search',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async (data, context) => {
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const initialBoardCard = requestContext.get('boardCard');
    Logger.info(`[AGENT] Tool board-card-search for board card ${initialBoardCard.id}: ${data.query}`);

    const { board } = initialBoardCard.loadedBoardColumn;

    const records = await IndexService.searchSemantic(board.id, {
      query: data.query,
      excludeBoardCardId: initialBoardCard.id,
    });
    if (records.length === 0) return [];

    const boardCardIds = unique(records.map((r) => r.boardCardId)).slice(0, LIMIT);
    const result = [];
    for (const boardCardId of boardCardIds) {
      const boardCard = await BoardCardService.findById(board, { boardCardId });
      const { boardCardContext } = await buildBoardCardContext(boardCard);
      result.push(boardCardContext);
    }
    return result;
  },
});

export const buildBoardCardContext = async (initialBoardCard: Loaded<BoardCard>) => {
  const boardCard = await BoardCardService.populate(initialBoardCard, [
    'boardColumn',
    'assignedBoardMember.user',
    'emailDraft.fileAttachments',
    'comments.user',
  ]);

  let emailMessagesDesc: Loaded<EmailMessage, 'gmailAttachments'>[] = [];

  if (boardCard.emailMessagesArchivable) {
    if (boardCard.externalThreadId) {
      emailMessagesDesc = await ArchiveService.emailMessagesDescByExternalThreadId(boardCard.externalThreadId);
    }
  } else {
    emailMessagesDesc = await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
      populate: ['gmailAttachments'],
      orderBy: { externalCreatedAt: 'DESC' },
    });
  }

  const lastEmailMessage = emailMessagesDesc[0] ?? null;
  const commentsAsc = [...boardCard.comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const gmailAttachments = emailMessagesDesc.flatMap((m) => [...m.gmailAttachments]);

  const boardCardContext = {
    boardCard: BoardCard.toPrompt(boardCard),
    emailDraft: boardCard.emailDraft && EmailDraft.toPrompt(boardCard.emailDraft),
    lastEmailMessage: lastEmailMessage && EmailMessage.toPrompt(lastEmailMessage),
    commentsAsc: commentsAsc.map(Comment.toPrompt),
    gmailAttachments: gmailAttachments.map(GmailAttachment.toPrompt),
  };
  Logger.debug(boardCardContext.boardCard);
  if (boardCardContext.emailDraft) Logger.debug(boardCardContext.emailDraft);
  if (boardCardContext.lastEmailMessage) Logger.debug(boardCardContext.lastEmailMessage);
  Logger.debugObjects(boardCardContext.commentsAsc);
  Logger.debugObjects(boardCardContext.gmailAttachments);

  return { boardCard, boardCardContext };
};
