import type { TRPCRouterRecord } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';
import { z } from 'zod';

import type { User } from '@/entities/user';
import { BoardService } from '@/services/board.service';
import { BoardInviteService } from '@/services/board-invite.service';
import { UserService } from '@/services/user.service';
import { unique } from '@/utils/lists';
import { DomainService } from './services/domain.service';
import { EmailMessageService } from './services/email-message.service';

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
      if (!ctx.user) return null;
      return ctx.user.toJson();
    }),
  } satisfies TRPCRouterRecord,
  board: {
    getBoard: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = await BoardService.findByIdForUser(input.boardId, { user: ctx.user, populate: ['boardColumns'] });
      return {
        board: board.toJson(),
        boardColumns: board.userColumns.map((col) => col.toJson()),
      };
    }),
    createFirstBoard: publicProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = await BoardService.createFirstBoard({ name: input.name, user: ctx.user });
      return board.toJson();
    }),
  } satisfies TRPCRouterRecord,
  boardCard: {
    getBoardCards: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = await BoardService.findByIdForUser(input.boardId, {
        user: ctx.user,
        populate: ['boardColumns', 'boardCards', 'gmailAccounts'],
      });
      const { userColumns } = board;
      const boardCards = board.boardCards
        .getItems()
        .filter((card) => userColumns.some((col) => col.id === card.boardColumn.id));

      const { emailMessagesByThreadId, domainNames } = await EmailMessageService.findMessagesByThreadId({
        gmailAccounts: board.gmailAccounts.getItems(),
        threadIds: unique(boardCards.map((card) => card.externalThreadId)),
      });
      const domainIconUrlByName = await DomainService.findDomainIconUrlByName(domainNames);
      return {
        boardCards: boardCards.map((card) => card.toJson()),
        gmailAccounts: board.gmailAccounts.getItems().map((acc) => acc.toJson()),
        domainIconUrlByName,
        emailMessagesByThreadId: Object.fromEntries(
          Object.entries(emailMessagesByThreadId).map(([threadId, emailMessages]) => [
            threadId,
            emailMessages.map((msg) => msg.toJson()),
          ]),
        ),
      };
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
        return invites.map((invite) => invite.toJson());
      }),
  } satisfies TRPCRouterRecord,
};

export const trpcRouter = createTRPCRouter(ROUTES);
export type TRPCRouter = typeof trpcRouter;
