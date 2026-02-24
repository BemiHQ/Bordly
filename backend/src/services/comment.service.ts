import type { Loaded, OrderDefinition, Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import type { BoardMember } from '@/entities/board-member';
import { Comment } from '@/entities/comment';
import type { User } from '@/entities/user';
import { AgentService } from '@/services/agent.service';
import { BoardMemberService } from '@/services/board-member.service';
import { EmailMessageService } from '@/services/email-message.service';
import { orm } from '@/utils/orm';
import { isBordlyComment } from '@/utils/shared';

export class CommentService {
  static async create(
    boardCard: Loaded<BoardCard, 'boardCardReadPositions'>,
    {
      board,
      user,
      text,
      userTimeZone,
    }: { board: Loaded<Board>; user: Loaded<User, 'boardMembers'>; text: string; userTimeZone?: string },
  ) {
    const comment = new Comment({ boardCard, user, text });
    const boardMember = user.boardMembers.find((bm) => bm.board.id === board.id)!;

    if (!boardCard.assignedBoardMember) boardCard.assignToBoardMember(boardMember);
    boardCard.addParticipantUserId(user.id);
    boardCard.setSnippet(`${user.firstName}: ${text}`);
    boardCard.setLastEventAt(comment.createdAt);

    const userBoardCardReadPosition = boardCard.boardCardReadPositions.find((pos) => pos.user.id === user.id)!;
    userBoardCardReadPosition.setLastReadAt(boardCard.lastEventAt);

    orm.em.persist([comment, boardCard, userBoardCardReadPosition]);

    await orm.em.flush();

    if (isBordlyComment(text)) {
      const userBoardMember = await BoardMemberService.findById(board, {
        boardMemberId: boardMember.id,
        populate: ['user', 'memory'],
      });
      const prompt = CommentService.bordlyPrompt(text);
      await AgentService.runBordlyAgent({ board, boardCardId: boardCard.id, prompt, userBoardMember, userTimeZone });
    }

    return comment;
  }

  static async edit<Hint extends string = never>(
    boardCard: Loaded<BoardCard, 'boardColumn'>,
    {
      board,
      user,
      commentId,
      text,
      userTimeZone,
      populate,
    }: {
      board: Loaded<Board>;
      user: Loaded<User, 'boardMembers'>;
      commentId: string;
      text: string;
      userTimeZone?: string;
      populate?: Populate<Comment, Hint>;
    },
  ) {
    const comment = await CommentService.findById(boardCard, { commentId, populate });
    const boardMember = user.boardMembers.find((bm) => bm.board.id === board.id)!;
    const wasLastBoardCardEvent = comment.createdAt.getTime() === boardCard.lastEventAt.getTime();

    comment.update({ text });
    orm.em.persist(comment);
    if (wasLastBoardCardEvent) {
      boardCard.setSnippet(`${comment.user.firstName}: ${text}`);
      orm.em.persist(boardCard);
    }

    await orm.em.flush();

    if (isBordlyComment(text)) {
      const userBoardMember = await BoardMemberService.findById(board, {
        boardMemberId: boardMember.id,
        populate: ['user', 'memory'],
      });

      const prompt = CommentService.bordlyPrompt(text);
      await AgentService.runBordlyAgent({ board, boardCardId: boardCard.id, prompt, userBoardMember, userTimeZone });
    }

    return comment;
  }

  static async delete(boardCard: BoardCard, { commentId }: { commentId: string }) {
    const comment = await CommentService.findById(boardCard, { commentId });

    const wasLastBoardCardEvent = comment.createdAt.getTime() === boardCard.lastEventAt.getTime();
    orm.em.remove(comment);

    if (wasLastBoardCardEvent) {
      const lastComment = (
        await CommentService.findCommentsByBoardCard(boardCard, {
          populate: ['user'],
          orderBy: { createdAt: 'DESC' },
          limit: 1,
        })
      )[0];

      const lastEmailMessage = (
        await EmailMessageService.findEmailMessagesByBoardCard(boardCard, {
          orderBy: { externalCreatedAt: 'DESC' },
          limit: 1,
        })
      )[0];

      if (lastComment && lastEmailMessage) {
        if (lastComment.createdAt.getTime() > lastEmailMessage.externalCreatedAt.getTime()) {
          boardCard.setSnippet(`${lastComment.user.firstName}: ${lastComment.text}`);
          boardCard.setLastEventAt(lastComment.createdAt);
        } else {
          boardCard.setSnippet(lastEmailMessage.snippet);
          boardCard.setLastEventAt(lastEmailMessage.externalCreatedAt);
        }
      } else if (lastComment) {
        boardCard.setSnippet(`${lastComment.user.firstName}: ${lastComment.text}`);
        boardCard.setLastEventAt(lastComment.createdAt);
      } else if (lastEmailMessage) {
        boardCard.setSnippet(lastEmailMessage.snippet);
        boardCard.setLastEventAt(lastEmailMessage.externalCreatedAt);
      }
      orm.em.persist(boardCard);
    }

    await orm.em.flush();
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
