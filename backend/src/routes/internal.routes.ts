import type { FastifyInstance } from 'fastify';
import { ROUTES } from '@/utils/urls';

export const internalRoutes = async (fastify: FastifyInstance) => {
  fastify.get(ROUTES.INTERNAL_HEALTH, async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });
};
