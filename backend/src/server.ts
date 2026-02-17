import cors from '@fastify/cors';
import secureSession from '@fastify/secure-session';
import { RequestContext } from '@mikro-orm/postgresql';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { listenToQueues } from '@/pg-boss-queues';
import { authRoutes } from '@/routes/auth.routes';
import { internalRoutes } from '@/routes/internal.routes';
import { createContext, trpcRouter } from '@/trpc-router';
import { ENV } from '@/utils/env';
import { setupFastifyErrorHandler } from '@/utils/error-tracking';
import { orm } from '@/utils/orm';
import { closePgBoss } from '@/utils/pg-boss';

const fastify = Fastify({ logger: false });
setupFastifyErrorHandler(fastify);

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
  cookieName: 'sId',
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

fastify.register(internalRoutes);
fastify.register(authRoutes);

const start = async () => {
  try {
    await listenToQueues();
    await fastify.listen({ port: ENV.PORT, host: '::' });
    console.log(`[HTTP] Server listening on port ${ENV.PORT}`);
  } catch (err) {
    console.error('[SERVER] Failed to start:', err);
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
