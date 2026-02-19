import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import secureSession from '@fastify/secure-session';
import { RequestContext } from '@mikro-orm/postgresql';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import { listenToQueues } from '@/pg-boss-queues';
import { authRoutes } from '@/routes/auth.routes';
import { fileAttachmentRoutes } from '@/routes/file-attachment.routes';
import { internalRoutes } from '@/routes/internal.routes';
import { proxyRoutes } from '@/routes/proxy.routes';
import { createContext } from '@/trpc-config';
import { trpcRouter } from '@/trpc-router';
import { ENV } from '@/utils/env';
import { reportError, setupFastifyErrorHandler } from '@/utils/error-tracking';
import { orm } from '@/utils/orm';
import { closePgBoss } from '@/utils/pg-boss';
import { ROUTES } from '@/utils/urls';

const SESSION_COOKIE_NAME = 'sId';

const fastify = Fastify({ logger: false });
setupFastifyErrorHandler(fastify);

fastify.addHook('onRequest', (request, _reply, done) => {
  if (!request.url.startsWith(ROUTES.TRPC) && request.url !== ROUTES.INTERNAL_HEALTH) {
    console.log(`[HTTP] ${request.method} ${request.url}`);
  }
  RequestContext.create(orm.em, done);
});

fastify.addHook('onResponse', (request, reply, done) => {
  if (!request.url.startsWith(ROUTES.TRPC) && request.url !== ROUTES.INTERNAL_HEALTH) {
    console.log(
      `[HTTP] ${request.method} ${request.url} [status=${reply.statusCode}, duration=${reply.elapsedTime.toFixed(2)}ms]`,
    );
  }
  done();
});

fastify.register(cors, {
  origin: ENV.APP_ENDPOINT,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['content-type', 'authorization', 'trpc-accept'],
  maxAge: 24 * 60 * 60, // 24 hours in seconds
});
fastify.register(secureSession, {
  key: Buffer.from(ENV.COOKIE_SECRET, 'base64'),
  cookieName: SESSION_COOKIE_NAME,
  expiry: 30 * 24 * 60 * 60, // 30 days in seconds
  cookie: { secure: true, httpOnly: true, sameSite: 'lax', domain: `.${ENV.ROOT_DOMAIN}`, path: '/' },
});
fastify.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB max file size (Gmail limit)
fastify.register(fastifyTRPCPlugin, { prefix: ROUTES.TRPC, trpcOptions: { router: trpcRouter, createContext } });

fastify.register(internalRoutes);
fastify.register(authRoutes);
fastify.register(proxyRoutes);
fastify.register(fileAttachmentRoutes);

const start = async () => {
  try {
    await listenToQueues();
    await fastify.listen({ port: ENV.PORT, host: '::' });
    console.log(`[HTTP] Server listening on port ${ENV.PORT}`);
  } catch (error) {
    reportError(error);
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
