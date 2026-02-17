import type { OrderDefinition, Populate } from '@mikro-orm/postgresql';
import type { Board } from '@/entities/board';
import type { BoardCard } from '@/entities/board-card';
import { Comment } from '@/entities/comment';
import type { User } from '@/entities/user';
import { orm } from '@/utils/orm';

export class CommentService {
  static async create(boardCard: BoardCard, { user, text, board }: { user: User; text: string; board: Board }) {
    const comment = new Comment({ boardCard, user, text });

    if (!boardCard.assignedBoardMember) {
      const boardMember = user.boardMembers.find((bm) => bm.board.id === board.id)!;
      boardCard.assignToBoardMember(boardMember);
    }
    boardCard.addParticipantUserId(user.id);
    boardCard.setSnippet(`${user.name}: ${text}`);
    boardCard.setLastEventAt(new Date());

    const userBoardCardReadPosition = boardCard.boardCardReadPositions.find((pos) => pos.user.id === user.id)!;
    userBoardCardReadPosition.setLastReadAt(boardCard.lastEventAt);

    orm.em.persist([comment, boardCard, userBoardCardReadPosition]);

    await orm.em.flush();

    return comment;
  }

  static async edit<Hint extends string = never>(
    board: Board,
    { commentId, text, populate }: { commentId: string; text: string; populate?: Populate<Comment, Hint> },
  ) {
    const comment = await orm.em.findOneOrFail(
      Comment,
      { id: commentId, boardCard: { boardColumn: { board } } },
      { populate },
    );

    comment.text = text;
    comment.editedAt = new Date();

    orm.em.persist(comment);
    await orm.em.flush();

    return comment;
  }

  static async delete(board: Board, { commentId }: { commentId: string }) {
    const comment = await orm.em.findOneOrFail(Comment, { id: commentId, boardCard: { boardColumn: { board } } });

    orm.em.remove(comment);
    await orm.em.flush();
  }

  static async findCommentsByBoardCard<Hint extends string = never>(
    boardCard: BoardCard,
    { populate, orderBy }: { populate?: Populate<Comment, Hint>; orderBy?: OrderDefinition<Comment> } = {},
  ) {
    return orm.em.find(Comment, { boardCard }, { populate, orderBy });
  }
}
