import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import session from '@fastify/session';
import { RequestContext } from '@mikro-orm/postgresql';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';

import { authRoutes } from '@/routes/auth-routes';
import { trpcRouter } from '@/trpc';
import { Env } from '@/utils/env';
import { orm } from '@/utils/orm';
import { createContext } from '@/utils/trpc';

const fastify = Fastify({ logger: true });

fastify.addHook('onRequest', (_request, _reply, done) => {
  RequestContext.create(orm.em, done);
});

fastify.register(cors, { origin: Env.APP_ENDPOINT, credentials: true });
fastify.register(cookie);
fastify.register(session, {
  secret: Env.COOKIE_SECRET,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1_000, // 30 days
  },
});
fastify.register(fastifyTRPCPlugin, { prefix: '/trpc', trpcOptions: { router: trpcRouter, createContext } });

fastify.register(authRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: Env.PORT });
    console.log(`Server listening on port ${Env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
