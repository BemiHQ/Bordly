import type { Populate } from '@mikro-orm/postgresql';
import { BoardInvite, State } from '@/entities/board-invite';
import type { User } from '@/entities/user';
import { BoardService } from '@/services/board.service';
import { Emailer, NO_REPLY_EMAIL } from '@/utils/emailer';
import { ENV } from '@/utils/env';
import { orm } from '@/utils/orm';
import { renderTemplate } from '@/utils/strings';

const INVITE_EMAIL_TEMPLATE = `{{inviterName}} has invited you to collaborate on the board "{{boardName}}". To accept the invitation, please click the link below:

{{inviteLink}}

If you did not expect this invitation, you can safely ignore this email.`;

export class BoardInviteService {
  static findPendingInvites<Hint extends string = never>(
    email: string,
    { populate }: { populate?: Populate<BoardInvite, Hint> } = { populate: [] },
  ) {
    if (!email) return null;
    return orm.em.find(BoardInvite, { email, state: State.PENDING }, { populate });
  }

  static async createInvites({ boardId, emails, invitedBy }: { boardId: string; emails: string[]; invitedBy: User }) {
    const board = await BoardService.findByIdForUser(boardId, { user: invitedBy });

    const existingBoardInvites = await orm.em.find(BoardInvite, {
      board,
      email: { $in: emails },
      state: [State.PENDING, State.ACCEPTED],
    });
    const existingInviteEmails = existingBoardInvites.map((invite) => invite.email);

    const invites = emails
      .filter((email) => !existingInviteEmails.includes(email))
      .map((email) => {
        const invite = new BoardInvite({ board, email, invitedBy });
        orm.em.persist(invite);
        return invite;
      });
    await orm.em.flush();

    for (const invite of invites) {
      await Emailer.send({
        from: NO_REPLY_EMAIL,
        to: [invite.email],
        subject: `You are invited by ${invitedBy.name}`,
        bodyText: renderTemplate(INVITE_EMAIL_TEMPLATE, {
          inviterName: invitedBy.name,
          boardName: board.name,
          inviteLink: ENV.APP_ENDPOINT,
        }),
      });
    }

    return invites;
  }
}
