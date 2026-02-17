import { RequestContext } from '@mikro-orm/postgresql';
import Fastify from 'fastify';

import { authRoutes } from './routes/auth';
import { Env } from './utils/env';
import { orm } from './utils/orm';

const fastify = Fastify({ logger: true });

fastify.addHook('onRequest', (_request, _reply, done) => {
  RequestContext.create(orm.em, done);
});

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
