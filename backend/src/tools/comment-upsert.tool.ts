import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import { z } from 'zod';
import type { User } from '@/entities/user';
import type { Context } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { BoardMemberService } from '@/services/board-member.service';
import { CommentService } from '@/services/comment.service';
import { Logger } from '@/utils/logger';

export const commentUpsertTool = createTool({
  id: 'comment-upsert',
  description: 'Insert or update a Bordly reply comment within the board card',
  inputSchema: z.object({
    contentHtml: z.string().min(1).describe('Comment content in HTML format'),
    contentText: z.string().min(1).describe('Comment content in plain text format'),
  }),
  execute: async (data, context) => {
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const initialBoardCard = requestContext.get('boardCard');
    Logger.debug(`[AGENT] Executing comment-upsert for board card ${initialBoardCard.id}: ${JSON.stringify(data)}`);

    const bordlyBoardMember = requestContext.get('bordlyBoardMember');
    await BoardMemberService.populate(bordlyBoardMember, ['user.boardMembers']);
    const bordlyUser = bordlyBoardMember.loadedUser as Loaded<User, 'boardMembers'>;

    const populatedBoardCard = await BoardCardService.populate(initialBoardCard, ['boardCardReadPositions']);

    const commentsAsc = [...initialBoardCard.comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const userComment = requestContext.get('userComment');
    const userCommentIndex = commentsAsc.findIndex((comment) => comment.id === userComment.id);
    if (userCommentIndex === -1) throw new Error('User comment not found in board card comments');

    const bordlyReplyComment = commentsAsc[userCommentIndex + 1];

    if (bordlyReplyComment && bordlyReplyComment.user.id === bordlyBoardMember.user.id) {
      const { boardCard } = await CommentService.edit(populatedBoardCard, {
        board: bordlyBoardMember.board,
        user: bordlyUser,
        commentId: bordlyReplyComment.id,
        contentHtml: data.contentHtml,
        contentText: data.contentText,
      });
      requestContext.set('boardCard', boardCard as typeof initialBoardCard);
    } else {
      const { boardCard } = await CommentService.create(populatedBoardCard, {
        board: bordlyBoardMember.board,
        user: bordlyUser,
        contentHtml: data.contentHtml,
        contentText: data.contentText,
      });
      requestContext.set('boardCard', boardCard as typeof initialBoardCard);
    }

    Logger.debug(`[AGENT] comment-upsert completed for board card ${initialBoardCard.id}`);
    return { success: true };
  },
});
