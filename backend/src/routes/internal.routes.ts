import type { FastifyInstance } from 'fastify';

export const internalRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/internal/health', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });
};
