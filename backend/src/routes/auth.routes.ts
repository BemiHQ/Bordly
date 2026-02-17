import type { FastifyInstance } from 'fastify';
import { BoardService } from '@/services/board.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { SenderEmailAddressService } from '@/services/sender-email-address.service';
import { UserService } from '@/services/user.service';
import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';
import { GoogleApi } from '@/utils/google-api';
import { QUERY_PARAMS } from '@/utils/shared';
import { APP_ENDPOINTS, ROUTES } from '@/utils/urls';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.modify',
];

export const authRoutes = async (fastify: FastifyInstance) => {
  fastify.get(ROUTES.AUTH_GOOGLE, async (request, reply) => {
    const { boardId } = request.query as { boardId?: string };
    const authUrl = GoogleApi.newOauth2Client().generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent',
      state: boardId ? JSON.stringify({ boardId }) : undefined,
    });
    reply.redirect(authUrl);
  });

  fastify.get(ROUTES.AUTH_GOOGLE_CALLBACK, async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    try {
      const oauth2Client = GoogleApi.newOauth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      const userInfo = await GoogleApi.newOauth2(oauth2Client).userinfo.get();

      let gmailAccount = await GmailAccountService.tryFindByExternalId(userInfo.data.id, {
        populate: ['user', 'senderEmailAddresses'],
      });
      let user = gmailAccount?.loadedUser;
      if (user) {
        gmailAccount = gmailAccount!;
        await GmailAccountService.setTokens(gmailAccount, {
          accessToken: tokens.access_token as string,
          refreshToken: tokens.refresh_token as string,
          accessTokenExpiresAt: new Date(tokens.expiry_date as number),
        });
        if (gmailAccount.senderEmailAddresses.length === 0) {
          try {
            await SenderEmailAddressService.syncEmailAddressesForGmailAccount(gmailAccount);
          } catch (error) {
            reportError(error, { email: userInfo.data.email! });
          }
        }
      } else {
        user = await UserService.createWithGmailAccount({
          email: userInfo.data.email as string,
          fullName: userInfo.data.name as string,
          firstName: userInfo.data.given_name as string,
          photoUrl: userInfo.data.picture as string,
          externalId: userInfo.data.id as string,
          accessToken: tokens.access_token as string,
          refreshToken: tokens.refresh_token as string,
          accessTokenExpiresAt: new Date(tokens.expiry_date as number),
        });
        gmailAccount = await GmailAccountService.tryFindByExternalId(userInfo.data.id, {
          populate: ['user', 'senderEmailAddresses'],
        });
      }

      const sessionUserId = request.session.get('userId');
      const currentUser = await UserService.tryFindById(sessionUserId, { populate: ['boardMembers.board'] });
      const { boardId } = JSON.parse(state || '{}') as { boardId?: string };

      if (currentUser && currentUser.id !== user.id && boardId) {
        // Add a new Gmail account to an existing board
        const board = BoardService.tryFindAsAdmin(boardId, { user: currentUser });
        if (!board) return reply.status(403).send({ error: 'Board not found or insufficient permissions' });
        await GmailAccountService.addToBoard(gmailAccount!, { board });
        const boardEndpoint = APP_ENDPOINTS.BOARD.replace('$boardId', boardId);
        return reply.redirect(`${boardEndpoint}?${QUERY_PARAMS.ADDED_GMAIL_ACCOUNT}=1`);
      } else {
        // Log in as the OAuth user
        request.session.set('userId', user.id);
        await UserService.updateLastSessionAt(user);
      }

      return reply.redirect(ENV.APP_ENDPOINT);
    } catch (error) {
      reportError(error);
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  });

  fastify.get(ROUTES.AUTH_LOG_OUT, async (request, reply) => {
    request.session.delete();
    return reply.redirect(ENV.APP_ENDPOINT);
  });
};
