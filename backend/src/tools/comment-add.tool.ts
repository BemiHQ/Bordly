import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { Loaded } from '@mikro-orm/postgresql';
import { z } from 'zod';
import type { User } from '@/entities/user';
import type { Context } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { BoardMemberService } from '@/services/board-member.service';
import { CommentService } from '@/services/comment.service';

export const commentAddTool = createTool({
  id: 'comment-add',
  description: 'Add a comment to the board card',
  inputSchema: z.object({
    contentHtml: z.string().min(1).describe('Comment content in HTML format'),
    contentText: z.string().min(1).describe('Comment content in plain text format'),
  }),
  execute: async (data, context) => {
    const { requestContext } = context as { requestContext: RequestContext<Context> };
    const initialBoardCard = requestContext.get('boardCard');
    console.log(`[AGENT] Executing comment-add for board card ${initialBoardCard.id}: ${JSON.stringify(data)}`);

    const bordlyBoardMember = requestContext.get('bordlyBoardMember');
    if (!bordlyBoardMember) throw new Error('Board member context is required');

    await BoardMemberService.populate(bordlyBoardMember, ['user.boardMembers']);
    const user = bordlyBoardMember.loadedUser as Loaded<User, 'boardMembers'>;

    const boardCard = await BoardCardService.populate(initialBoardCard, ['boardCardReadPositions']);

    const { boardCard: updatedBoardCard } = await CommentService.create(boardCard, {
      board: bordlyBoardMember.board,
      user,
      contentHtml: data.contentHtml,
      contentText: data.contentText,
    });

    requestContext.set('boardCard', updatedBoardCard);
    return { success: true };
  },
});
