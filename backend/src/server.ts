import cors from '@fastify/cors';
import secureSession from '@fastify/secure-session';
import { RequestContext } from '@mikro-orm/postgresql';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';

import { authRoutes } from '@/routes/auth.routes';
import { trpcRouter } from '@/trpc-router';
import { ENV } from '@/utils/env';
import { orm } from '@/utils/orm';
import { createContext } from '@/utils/trpc';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'time,pid,hostname',
        singleLine: true,
      },
    },
  },
});

fastify.addHook('onRequest', (_request, _reply, done) => {
  RequestContext.create(orm.em, done);
});

fastify.register(cors, { origin: ENV.APP_ENDPOINT, credentials: true });
fastify.register(secureSession, {
  key: Buffer.from(ENV.COOKIE_SECRET, 'base64'),
  cookieName: ENV.COOKIE_SESSION_NAME,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    domain: `.${ENV.ROOT_DOMAIN}`,
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    path: '/',
  },
});
fastify.register(fastifyTRPCPlugin, { prefix: '/trpc', trpcOptions: { router: trpcRouter, createContext } });

fastify.register(authRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: ENV.PORT });
    console.log(`Server listening on port ${ENV.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
