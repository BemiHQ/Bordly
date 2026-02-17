import Fastify from 'fastify';
import { authRoutes } from './routes/auth.js';

const fastify = Fastify({ logger: true });

fastify.register(authRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('Server listening on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
