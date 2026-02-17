import type { FastifyInstance } from 'fastify';
import { type Auth, google } from 'googleapis';
import { Env } from '../utils/env';

const OAUTH2_CLIENT: Auth.OAuth2Client = new google.auth.OAuth2(
  Env.GOOGLE_OAUTH_CLIENT_ID,
  Env.GOOGLE_OAUTH_CLIENT_SECRET,
  Env.GOOGLE_OAUTH_CALLBACK_URL,
);

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.modify',
];

export async function authRoutes(fastify: FastifyInstance) {
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

      return {
        user: {
          googleId: userInfo.data.id,
          email: userInfo.data.email,
          name: userInfo.data.name,
          picture: userInfo.data.picture,
        },
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Authentication failed' });
    }
  });
}
