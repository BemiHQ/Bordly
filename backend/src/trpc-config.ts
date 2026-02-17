import { NotFoundError } from '@mikro-orm/postgresql';
import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';
import { BoardService } from '@/services/board.service';
import { UserService } from '@/services/user.service';
import { ENV } from '@/utils/env';
import { sleep } from '@/utils/time';

const DEVELOPMENT_MAX_DELAY_MS = 1_000;

export const createContext = async ({ req }: CreateFastifyContextOptions) => {
  const userId = req.session.get('userId') as string | undefined;
  const user = await UserService.tryFindById(userId, { populate: ['boardMembers.board.boardMembers'] });
  return { user };
};
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

const errorHandlerMiddleware = t.middleware(async ({ next }) => {
  const result = await next();

  if (!result.ok && result.error.cause) {
    const error = result.error.cause;

    if (error instanceof NotFoundError) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
  }

  return result;
});

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
export const publicProcedure = t.procedure.use(errorHandlerMiddleware).use(loggingMiddleware);

export const authAsBoardMember = ({ ctx, input }: { ctx: Context; input: { boardId: string } }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const board = BoardService.tryFindAsMember(input.boardId, { user: ctx.user });
  if (!board) throw new TRPCError({ code: 'NOT_FOUND' });
  return { board, user: ctx.user };
};

export const authAsBoardAdmin = ({ ctx, input }: { ctx: Context; input: { boardId: string } }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const board = BoardService.tryFindAsAdmin(input.boardId, { user: ctx.user });
  if (!board) throw new TRPCError({ code: 'NOT_FOUND' });
  return { board, user: ctx.user };
};
