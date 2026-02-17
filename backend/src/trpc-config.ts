import { initTRPC } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';
import { UserService } from '@/services/user.service';
import { ENV } from '@/utils/env';
import { sleep } from '@/utils/time';

const DEVELOPMENT_MAX_DELAY_MS = 1_000;

export const createContext = async ({ req }: CreateFastifyContextOptions) => {
  const userId = req.session.get('userId') as string | undefined;
  const user = await UserService.tryFindById(userId, { populate: ['boardMembers.board'] });
  return { user };
};
type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  console.log(`[TRPC server] ${type} ${path} [userId=${ctx.user?.id || ''}]`);

  if (ENV.NODE_ENV !== 'production') {
    const delayMs = Math.floor(Math.random() * DEVELOPMENT_MAX_DELAY_MS);
    await sleep(delayMs);
  }

  const result = await next();

  const duration = Date.now() - start;
  if (result.ok) {
    console.log(`[TRPC server] ${type} ${path} [userId=${ctx.user?.id || ''}, duration=${duration}ms]`);
  } else {
    console.error(
      `[TRPC server] ${type} ${path} [userId=${ctx.user?.id || ''}, duration=${duration}ms]:\nERROR: ${result.error}`,
    );
  }

  return result;
});
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(loggingMiddleware);
