import type { Board } from '@/entities/board';
import { BoardCardReadPosition } from '@/entities/board-card-read-position';
import { BoardInvite, Role, State } from '@/entities/board-invite';
import { BoardMember } from '@/entities/board-member';
import type { User } from '@/entities/user';
import { BoardCardService } from '@/services/board-card.service';
import { Emailer, NO_REPLY_EMAIL } from '@/utils/emailer';
import { ENV } from '@/utils/env';
import { orm } from '@/utils/orm';
import { renderTemplate } from '@/utils/strings';

const INVITE_EMAIL_TEMPLATE = `{{inviterName}} has invited you to collaborate on the board "{{boardName}}". To accept the invitation, please click the link below:

{{inviteLink}}

If you did not expect this invitation, you can safely ignore this email.`;

export class BoardInviteService {
  static findPendingInvites(board: Board) {
    return orm.em.find(BoardInvite, { board, state: State.PENDING });
  }

  static async acceptPendingInvites({ email, user }: { email: string; user: User }) {
    const boardInvites = await orm.em.find(BoardInvite, { email, state: State.PENDING }, { populate: ['board'] });
    const invitesAndMembers: { boardInvite: BoardInvite; boardMember: BoardMember }[] = [];

    if (boardInvites && boardInvites.length > 0) {
      for (const boardInvite of boardInvites) {
        const boardMember = new BoardMember({ board: boardInvite.board, user, role: boardInvite.role });
        boardInvite.markAsAccepted();

        const { boardCardsDesc } = await BoardCardService.findInboxCardsByBoardId(boardInvite.board.id);
        for (const boardCard of boardCardsDesc) {
          boardCard.boardCardReadPositions.add(
            new BoardCardReadPosition({ boardCard, user, lastReadAt: boardCard.lastEventAt }),
          );
          orm.em.persist(boardCard);
        }

        orm.em.persist([boardInvite, boardMember]);
      }
    }

    return invitesAndMembers;
  }

  static async create(board: Board, { email, role, invitedBy }: { email: string; role: Role; invitedBy: User }) {
    const boardInvite = new BoardInvite({ board, state: State.PENDING, email, role, invitedBy });
    orm.em.persist(boardInvite);
    await orm.em.flush();
    await BoardInviteService.sendInviteEmail(boardInvite);
    return boardInvite;
  }

  static async createMemberBoardInvites(board: Board, { emails, invitedBy }: { emails: string[]; invitedBy: User }) {
    if (emails.length === 0) return [];

    const existingBoardInvites = await orm.em.find(BoardInvite, {
      board,
      email: { $in: emails },
      state: [State.PENDING, State.ACCEPTED],
    });
    const existingInviteEmails = existingBoardInvites.map((boardInvite) => boardInvite.email);

    const boardInvites = emails
      .filter((email) => !existingInviteEmails.includes(email))
      .map((email) => {
        const boardInvite = new BoardInvite({ board, state: State.PENDING, email, role: Role.MEMBER, invitedBy });
        orm.em.persist(boardInvite);
        return boardInvite;
      });
    await orm.em.flush();

    for (const boardInvite of boardInvites) {
      await BoardInviteService.sendInviteEmail(boardInvite);
    }

    return boardInvites;
  }

  static async setRole(board: Board, { boardInviteId, role }: { boardInviteId: string; role: Role }) {
    const boardInvite = await BoardInviteService.findById(board, { boardInviteId });
    boardInvite.setRole(role);
    await orm.em.persist(boardInvite).flush();
    return boardInvite;
  }

  static async delete(board: Board, { boardInviteId }: { boardInviteId: string }) {
    const boardInvite = await BoardInviteService.findById(board, { boardInviteId });
    await orm.em.remove(boardInvite).flush();
  }

  static async sendInviteEmail(boardInvite: BoardInvite) {
    await Emailer.send({
      from: NO_REPLY_EMAIL,
      to: [boardInvite.email],
      subject: `You are invited by ${boardInvite.loadedInvitedBy.name}`,
      bodyText: renderTemplate(INVITE_EMAIL_TEMPLATE, {
        inviterName: boardInvite.loadedInvitedBy.name,
        boardName: boardInvite.loadedBoard.name,
        inviteLink: ENV.APP_ENDPOINT,
      }),
    });
  }

  private static async findById(board: Board, { boardInviteId }: { boardInviteId: string }) {
    return orm.em.findOneOrFail(BoardInvite, { board, id: boardInviteId });
  }
}
