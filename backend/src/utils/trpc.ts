import { initTRPC } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';

import type { User } from '@/entities/user';
import { UserService } from '@/services/user.service';

export const createContext = async ({ req }: CreateFastifyContextOptions) => {
  const userId = req.session.get('userId') as string | undefined;

  let user: User | null = null;
  if (userId) {
    user = await UserService.findById(userId, { populate: ['boards'] });
  }

  return { user };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create({ transformer: superjson });
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
