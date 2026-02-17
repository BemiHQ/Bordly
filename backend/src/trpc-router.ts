import type { TRPCRouterRecord } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import superjson from 'superjson';
import { z } from 'zod';
import { State } from '@/entities/board-card';
import { Role } from '@/entities/board-member';
import { BoardService } from '@/services/board.service';
import { BoardInviteService } from '@/services/board-invite.service';
import { BoardMemberService } from '@/services/board-member.service';
import { UserService } from '@/services/user.service';
import { BoardCardService } from './services/board-card.service';
import { EmailMessageService } from './services/email-message.service';
import { GmailAccountService } from './services/gmail-account.service';

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
      return {
        currentUser: ctx.user.toJson(),
        boards: ctx.user.boardMembers.getItems().map((bm) => bm.board.toJson()),
      };
    }),
  } satisfies TRPCRouterRecord,
  board: {
    get: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
      await BoardService.populate(board, ['boardColumns', 'gmailAccounts']);
      return {
        board: board.toJson(),
        boardColumns: board.boardColumns.map((col) => col.toJson()),
        gmailAccounts: board.gmailAccounts.map((acc) => acc.toJson()),
      };
    }),
    createFirstBoard: publicProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = await BoardService.createFirstBoard({ name: input.name, user: ctx.user });
      return { board: board.toJson() };
    }),
    deleteGmailAccount: publicProcedure
      .input(z.object({ boardId: z.uuid(), gmailAccountId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        await GmailAccountService.deleteFromBoard(board, { gmailAccountId: input.gmailAccountId });
      }),
  } satisfies TRPCRouterRecord,
  boardCard: {
    getBoardCards: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
      const boardCards = await BoardCardService.findCardsByBoard(board, { populate: ['domain'] });
      return { boardCards: boardCards.map((card) => card.toJson()) };
    }),
    markAsRead: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        const boardCard = await BoardCardService.markAsRead(board, {
          boardCardId: input.boardCardId,
          populate: ['domain'],
        });
        return { boardCard: boardCard.toJson() };
      }),
    markAsUnread: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        const boardCard = await BoardCardService.markAsUnread(board, {
          boardCardId: input.boardCardId,
          populate: ['domain'],
        });
        return { boardCard: boardCard.toJson() };
      }),
    setBoardColumn: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), boardColumnId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        const boardCard = await BoardCardService.setBoardColumn(board, {
          boardCardId: input.boardCardId,
          boardColumnId: input.boardColumnId,
          populate: ['domain'],
        });
        return { boardCard: boardCard.toJson() };
      }),
    setState: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid(), state: z.enum(Object.values(State)) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        const boardCard = await BoardCardService.setState(board, {
          boardCardId: input.boardCardId,
          state: input.state,
          populate: ['domain'],
        });
        return { boardCard: boardCard.toJson() };
      }),
  } satisfies TRPCRouterRecord,
  boardInvite: {
    getBoardInvites: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
      const boardInvites = await BoardInviteService.findPendingInvites(board);
      return { boardInvites: boardInvites.map((boardInvite) => boardInvite.toJson()) };
    }),
    create: publicProcedure
      .input(z.object({ boardId: z.uuid(), email: z.email(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        const boardInvite = await BoardInviteService.create(board, {
          email: input.email,
          role: input.role,
          invitedBy: ctx.user,
        });
        return { boardInvite: boardInvite.toJson() };
      }),
    createMemberBoardInvites: publicProcedure
      .input(z.object({ boardId: z.uuid(), emails: z.array(z.email()) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        await BoardInviteService.createMemberBoardInvites(board, { emails: input.emails, invitedBy: ctx.user });
      }),
    setRole: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardInviteId: z.uuid(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        const boardInvite = await BoardInviteService.setRole(board, {
          boardInviteId: input.boardInviteId,
          role: input.role,
        });
        return { boardInvite: boardInvite.toJson() };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardInviteId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        await BoardInviteService.delete(board, { boardInviteId: input.boardInviteId });
      }),
  } satisfies TRPCRouterRecord,
  boardMember: {
    getBoardMembers: publicProcedure.input(z.object({ boardId: z.uuid() })).query(async ({ input, ctx }) => {
      if (!ctx.user) throw new Error('Not authenticated');
      const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
      const boardMembers = await BoardMemberService.findMembers(board, { populate: ['user'] });
      return { boardMembers: boardMembers.map((member) => member.toJson()) };
    }),
    setRole: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid(), role: z.enum(Object.values(Role)) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        const boardMember = await BoardMemberService.setRole(board, {
          userId: input.userId,
          role: input.role,
          currentUser: ctx.user,
        });
        return { boardMember: boardMember.toJson() };
      }),
    delete: publicProcedure
      .input(z.object({ boardId: z.uuid(), userId: z.uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsAdmin(input.boardId, { user: ctx.user });
        await BoardMemberService.delete(board, { userId: input.userId, currentUser: ctx.user });
      }),
  } satisfies TRPCRouterRecord,
  emailMessage: {
    getEmailMessages: publicProcedure
      .input(z.object({ boardId: z.uuid(), boardCardId: z.uuid() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error('Not authenticated');
        const board = BoardService.findAsMember(input.boardId, { user: ctx.user });
        const { boardCard, emailMessages } = await EmailMessageService.findEmailMessages(board, {
          boardCardId: input.boardCardId,
          populate: ['domain', 'attachments'],
        });
        return {
          boardCard: boardCard.toJson(),
          emailMessages: emailMessages.map((msg) => msg.toJson()),
        };
      }),
  } satisfies TRPCRouterRecord,
};

export const trpcRouter = createTRPCRouter(ROUTES);
export type TRPCRouter = typeof trpcRouter;
