import type { TRPCRouterRecord } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';
import { z } from 'zod';

import type { User } from '@/entities/user';
import { BoardService } from '@/services/board.service';
import { BoardInviteService } from '@/services/board-invite.service';
import { UserService } from '@/services/user.service';
import { BoardCardService } from './services/board-card.service';

export const createContext = async ({ req }: CreateFastifyContextOptions) => {
  const userId = req.session.get('userId') as string | undefined;
  let user: User | null = null;
  if (userId) {
    user = await UserService.tryFindById(userId, { populate: ['boards'] });
  }
  return { user };
};
type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  console.log(`[TRPC server] ${type} ${path} [userId=${ctx.user?.id || ''}]`);

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
const createTRPCRouter = t.router;
const publicProcedure = t.procedure.use(loggingMiddleware);

// ---------------------------------------------------------------------------------------------------------------------

const ROUTES = {
  user: {
    getCurrentUser: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return { currentUser: null };
      return { currentUser: ctx.user.toJson() };
    }),
  } satisfies TRPCRouterRecord,
  board: {
    getBoard: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = await BoardService.findByIdForUser(input.boardId, {
        user: ctx.user,
        populate: ['boardColumns', 'gmailAccounts'],
      });
      return {
        board: board.toJson(),
        boardColumns: board.userColumns.map((col) => col.toJson()),
        gmailAccounts: board.gmailAccounts.map((acc) => acc.toJson()),
      };
    }),
    createFirstBoard: publicProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = await BoardService.createFirstBoard({ name: input.name, user: ctx.user });
      return { board: board.toJson() };
    }),
  } satisfies TRPCRouterRecord,
  boardCard: {
    getBoardCards: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const boardCards = await BoardCardService.findCardsByBoardId(input.boardId, {
        user: ctx.user,
        populate: ['domain'],
      });
      return { boardCards: boardCards.map((card) => card.toJson()) };
    }),
  } satisfies TRPCRouterRecord,
  boardInvite: {
    createInvites: publicProcedure
      .input(z.object({ boardId: z.uuid(), emails: z.array(z.email()) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const invites = await BoardInviteService.createInvites({
          boardId: input.boardId,
          emails: input.emails,
          invitedBy: ctx.user,
        });
        return { invites: invites.map((invite) => invite.toJson()) };
      }),
  } satisfies TRPCRouterRecord,
};

export const trpcRouter = createTRPCRouter(ROUTES);
export type TRPCRouter = typeof trpcRouter;
