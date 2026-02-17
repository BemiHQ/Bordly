import cors from '@fastify/cors';
import secureSession from '@fastify/secure-session';
import { RequestContext } from '@mikro-orm/postgresql';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';

import { authRoutes } from '@/routes/auth.routes';
import { trpcRouter } from '@/trpc-router';
import { ENV } from '@/utils/env';
import { orm } from '@/utils/orm';
import { closePgBoss, listenToQueues, pgBossInstance } from '@/utils/pg-boss';
import { createContext } from '@/utils/trpc';

const fastify = Fastify({ logger: false });

fastify.addHook('onRequest', (request, _reply, done) => {
  if (!request.url.startsWith('/trpc/')) {
    console.log(`[HTTP] ${request.method} ${request.url}`);
  }
  RequestContext.create(orm.em, done);
});

fastify.addHook('onResponse', (request, reply, done) => {
  if (!request.url.startsWith('/trpc/')) {
    console.log(
      `[HTTP] ${request.method} ${request.url} [status=${reply.statusCode}, duration=${reply.elapsedTime.toFixed(2)}ms]`,
    );
  }
  done();
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
    const boss = await pgBossInstance();
    await listenToQueues(boss);

    await fastify.listen({ port: ENV.PORT });
    console.log(`[HTTP] Server listening on port ${ENV.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully');
  await closePgBoss();
  await fastify.close();
  process.exit(0);
});

start();
