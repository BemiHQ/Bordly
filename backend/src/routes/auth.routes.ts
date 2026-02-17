import type { FastifyInstance } from 'fastify';
import { type Auth, google } from 'googleapis';

import type { User } from '@/entities/user';
import { GmailAccountService } from '@/services/gmail-account.service';
import { UserService } from '@/services/user.service';
import { ENV } from '@/utils/env';

const OAUTH2_CLIENT: Auth.OAuth2Client = new google.auth.OAuth2(
  ENV.GOOGLE_OAUTH_CLIENT_ID,
  ENV.GOOGLE_OAUTH_CLIENT_SECRET,
  ENV.GOOGLE_OAUTH_CALLBACK_URL,
);

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.modify',
];

export const authRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/auth/google', async (_request, reply) => {
    const authUrl = OAUTH2_CLIENT.generateAuthUrl({ access_type: 'offline', scope: GOOGLE_SCOPES, prompt: 'consent' });
    reply.redirect(authUrl);
  });

  fastify.get('/auth/google/callback', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.status(400).send({ error: 'Missing authorization code' });
    }

    try {
      const { tokens } = await OAUTH2_CLIENT.getToken(code);
      OAUTH2_CLIENT.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: OAUTH2_CLIENT });
      const userInfo = await oauth2.userinfo.get();

      const gmailAccount = await GmailAccountService.tryFindByGoogleId(userInfo.data.id, { populate: ['user'] });
      let user = gmailAccount?.user as User;
      if (!user) {
        user = await UserService.createWithGmailAccount({
          email: userInfo.data.email || '',
          name: userInfo.data.name || '',
          photoUrl: userInfo.data.picture || '',
          googleId: userInfo.data.id || '',
          accessToken: tokens.access_token || '',
          refreshToken: tokens.refresh_token || '',
          accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        });
      }
      await UserService.updateLastSessionAt(user);
      request.session.set('userId', user.id);

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
