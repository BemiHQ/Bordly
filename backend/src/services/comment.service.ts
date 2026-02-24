import type { Loaded, OrderDefinition, Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import { Comment } from '@/entities/comment';
import type { User } from '@/entities/user';
import { AgentService } from '@/services/agent.service';
import { BoardCardService } from '@/services/board-card.service';
import { BoardMemberService } from '@/services/board-member.service';
import { orm } from '@/utils/orm';
import { isBordlyComment } from '@/utils/shared';

export class CommentService {
  static async create(
    boardCard: Loaded<BoardCard, 'boardCardReadPositions'>,
    {
      board,
      user,
      contentHtml,
      contentText,
      userTimeZone,
    }: {
      board: Loaded<Board>;
      user: Loaded<User, 'boardMembers'>;
      contentHtml: string;
      contentText: string;
      userTimeZone?: string;
    },
  ) {
    const comment = new Comment({ boardCard, user, contentHtml, contentText });
    const boardMember = user.boardMembers.find((bm) => bm.board.id === board.id)!;

    if (!boardCard.assignedBoardMember) boardCard.assignToBoardMember(boardMember);
    boardCard.addParticipantUserId(user.id);
    boardCard.setSnippet(`${user.firstName}: ${contentText}`);
    boardCard.setLastEventAt(comment.createdAt);

    const userBoardCardReadPosition = boardCard.boardCardReadPositions.find((pos) => pos.user.id === user.id)!;
    userBoardCardReadPosition.setLastReadAt(boardCard.lastEventAt);

    orm.em.persist([comment, boardCard, userBoardCardReadPosition]);

    await orm.em.flush();

    if (isBordlyComment(contentText)) {
      const userBoardMember = await BoardMemberService.findById(board, {
        boardMemberId: boardMember.id,
        populate: ['user', 'memory'],
      });
      const prompt = CommentService.bordlyPrompt(contentText);
      const updatedBoardCard = await AgentService.runBordlyAgent({
        board,
        boardCard,
        prompt,
        userBoardMember,
        userTimeZone,
      });
      return { boardCard: updatedBoardCard, comment };
    }

    return { boardCard, comment };
  }

  static async edit<Hint extends string = never>(
    boardCard: Loaded<BoardCard, 'boardColumn'>,
    {
      board,
      user,
      commentId,
      contentHtml,
      contentText,
      userTimeZone,
      populate,
    }: {
      board: Loaded<Board>;
      user: Loaded<User, 'boardMembers'>;
      commentId: string;
      contentHtml: string;
      contentText: string;
      userTimeZone?: string;
      populate?: Populate<Comment, Hint>;
    },
  ) {
    const comment = await CommentService.findById(boardCard, { commentId, populate });
    const boardMember = user.boardMembers.find((bm) => bm.board.id === board.id)!;
    const wasLastBoardCardEvent = comment.createdAt.getTime() === boardCard.lastEventAt.getTime();

    comment.update({ contentHtml, contentText });
    orm.em.persist(comment);
    if (wasLastBoardCardEvent) {
      boardCard.setSnippet(`${comment.user.firstName}: ${contentText}`);
      orm.em.persist(boardCard);
    }

    await orm.em.flush();

    if (isBordlyComment(contentText)) {
      const userBoardMember = await BoardMemberService.findById(board, {
        boardMemberId: boardMember.id,
        populate: ['user', 'memory'],
      });

      const prompt = CommentService.bordlyPrompt(contentText);
      const updatedBoardCard = await AgentService.runBordlyAgent({
        board,
        boardCard,
        prompt,
        userBoardMember,
        userTimeZone,
      });
      return { boardCard: updatedBoardCard, comment };
    }

    return { boardCard, comment };
  }

  static async delete(boardCard: BoardCard, { commentId }: { commentId: string }) {
    const comment = await CommentService.findById(boardCard, { commentId });
    orm.em.remove(comment);

    await BoardCardService.rebuildLastEventAtAndSnippet(boardCard, { ignoreLastEventAt: comment.createdAt });
    orm.em.persist(boardCard);

    await orm.em.flush();
    return boardCard;
  }

  static async findCommentsByBoardCard<Hint extends string = never>(
    boardCard: BoardCard,
    {
      populate,
      orderBy,
      limit,
    }: { populate?: Populate<Comment, Hint>; orderBy?: OrderDefinition<Comment>; limit?: number },
  ) {
    return orm.em.find(Comment, { boardCard }, { populate, orderBy, limit });
  }

  // -------------------------------------------------------------------------------------------------------------------

  private static bordlyPrompt(text: string) {
    return text.replace(/^@bordly\s*/i, '').trim();
  }

  private static async findById<Hint extends string = never>(
    boardCard: BoardCard,
    { commentId, populate }: { commentId: string; populate?: Populate<Comment, Hint> },
  ) {
    return orm.em.findOneOrFail(Comment, { id: commentId, boardCard }, { populate });
  }
}
