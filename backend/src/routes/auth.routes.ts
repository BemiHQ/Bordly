import type { FastifyInstance } from 'fastify';

import type { User } from '@/entities/user';
import { GmailAccountService } from '@/services/gmail-account.service';
import { UserService } from '@/services/user.service';
import { ENV } from '@/utils/env';
import { newOauth2, newOauth2Client } from '@/utils/google-api';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.modify',
];

export const authRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/auth/google', async (request, reply) => {
    const { boardId } = request.query as { boardId?: string };
    const authUrl = newOauth2Client().generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent',
      state: boardId ? JSON.stringify({ boardId }) : undefined,
    });
    reply.redirect(authUrl);
  });

  fastify.get('/auth/google/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    try {
      const oauth2Client = newOauth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);
      const userInfo = await newOauth2(oauth2Client).userinfo.get();

      let gmailAccount = await GmailAccountService.tryFindByGoogleId(userInfo.data.id, { populate: ['user'] });
      let user = gmailAccount?.user as User;
      if (!user) {
        const userAndGmailAccount = await UserService.createWithGmailAccount({
          email: userInfo.data.email as string,
          name: userInfo.data.name as string,
          photoUrl: userInfo.data.picture as string,
          googleId: userInfo.data.id as string,
          accessToken: tokens.access_token as string,
          refreshToken: tokens.refresh_token as string,
          accessTokenExpiresAt: new Date(tokens.expiry_date as number),
        });
        user = userAndGmailAccount.user;
        gmailAccount = userAndGmailAccount.gmailAccount;
      }

      await UserService.updateLastSessionAt(user);

      let currentUser: User | null = null;
      const sessionUserId = request.session.get('userId');
      if (sessionUserId) {
        currentUser = await UserService.tryFindById(sessionUserId, { populate: ['boards'] });
      }

      if (currentUser) {
        const { boardId } = JSON.parse(state || '{}') as { boardId?: string };
        if (boardId) {
          await GmailAccountService.addToBoard(gmailAccount!, { boardId, user: currentUser });
        }
      } else {
        request.session.set('userId', user.id);
      }

      return reply.redirect(ENV.APP_ENDPOINT);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  });

  fastify.get('/auth/log-out', async (request, reply) => {
    request.session.delete();
    return reply.redirect(ENV.APP_ENDPOINT);
  });
};
