import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';

import { Navbar } from '@/components/navbar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { cn, extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

const MAX_BOARD_COLUMN_POSITION = 1_000; // System Spam and Trash

type Board = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type BoardColumn = Board['boardColumns'][number];

type BoardCards = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
type BoardCard = BoardCards['boardCards'][number];
type EmailMessagesByThreadId = BoardCards['emailMessagesByThreadId'];
type EmailMessage = EmailMessagesByThreadId[number][number];
type GmailAccount = BoardCards['gmailAccounts'][number];

export const Route = createFileRoute('/boards/$boardId')({
  component: Home,
  loader: async ({ context, params }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }

    const board = await context.queryClient.ensureQueryData(
      context.trpc.board.getBoard.queryOptions({
        boardId: extractUuid(params.boardId),
      }),
    );

    return { currentUser, board };
  },
});

const EmptyState = () => (
  <Empty className="w-full">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Spinner />
      </EmptyMedia>
      <EmptyTitle>Importing your emails...</EmptyTitle>
      <EmptyDescription>Please wait while we set up your board. This may take a few minutes.</EmptyDescription>
    </EmptyHeader>
  </Empty>
);

const BoardNavbar = ({ board }: { board: Board }) => {
  return (
    <div className="border-b bg-background px-6 py-3">
      <h1 className="font-semibold">{board.board.name}</h1>
    </div>
  );
};

const BoardColumn = ({ boardColumn, children }: { boardColumn: BoardColumn; children: React.ReactNode }) => {
  if (boardColumn.position > MAX_BOARD_COLUMN_POSITION) return null;

  return (
    <div className="flex w-68 h-fit max-h-[calc(100vh-116px)] flex-col gap-2 rounded-lg bg-primary-foreground p-2 border border-border scrollbar-thin overflow-y-auto shadow-sm">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{boardColumn.name}</h2>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
};

const BoardCard = ({
  boardCard: _boardCard,
  gmailAccounts,
  domainIconUrlByName,
  emailMessages,
}: {
  boardCard: BoardCard;
  gmailAccounts: GmailAccount[];
  domainIconUrlByName: Record<string, string>;
  emailMessages: EmailMessage[];
}) => {
  const title = emailMessages.find((msg) => msg.subject)?.subject || 'No subject';
  const snippet = emailMessages[emailMessages.length - 1]?.snippet || 'Empty';
  const participants = emailMessages
    .flatMap((msg) =>
      msg.sent
        ? [...(msg.to || []), ...(msg.cc || []), ...(msg.bcc || [])]
        : [msg.from, ...(msg.to || []), ...(msg.cc || [])],
    )
    .filter((p) => !gmailAccounts.some((account) => p.email === account.email));
  const anyUnread = emailMessages.some((msg) => !msg.read);

  return (
    <Card className="cursor-pointer p-3 transition-shadow hover:bg-background rounded-lg shadow-xs flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Avatar size="xs">
          <AvatarImage
            src={domainIconUrlByName[participants[0].email.split('@')[1]]}
            alt={participants[0].name || participants[0].email}
          />
          <AvatarFallback hashForBgColor={participants[0].email}>
            {(participants[0].name || participants[0].email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-sm truncate flex items-center">
          {anyUnread && <div className="bg-blue-500 rounded-full min-w-2 min-h-2 mr-1.5" />}
          <span className={anyUnread ? 'font-bold' : 'font-medium'}>
            {participants[0].name || participants[0].email}
          </span>
          {participants.length > 1 && (
            <span className="text-muted-foreground">
              ,{' '}
              {participants
                .slice(1)
                .map((p) => p.name || p.email)
                .join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className={cn('text-xs truncate', anyUnread && 'font-medium')}>{title}</div>
      <div className="text-xs text-muted-foreground truncate">{snippet}</div>
    </Card>
  );
};

function Home() {
  const { currentUser, board } = Route.useLoaderData();
  const context = Route.useRouteContext();
  const params = Route.useParams();
  const { data: boardCardsData } = useQuery(
    context.trpc.boardCard.getBoardCards.queryOptions({
      boardId: extractUuid(params.boardId),
    }),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      <BoardNavbar board={board} />
      {board.boardColumns.length === 0 && <EmptyState />}
      {board.boardColumns.length > 0 && (
        <div className="flex overflow-x-auto p-3 gap-3">
          {board.boardColumns.map((boardColumn) => (
            <BoardColumn key={boardColumn.id} boardColumn={boardColumn}>
              {boardCardsData?.boardCards
                .filter((card) => card.boardColumnId === boardColumn.id)
                .map((boardCard) => (
                  <BoardCard
                    key={boardCard.id}
                    boardCard={boardCard}
                    gmailAccounts={boardCardsData.gmailAccounts}
                    domainIconUrlByName={boardCardsData.domainIconUrlByName}
                    emailMessages={boardCardsData.emailMessagesByThreadId[boardCard.externalThreadId]}
                  />
                ))}
            </BoardColumn>
          ))}
        </div>
      )}
    </div>
  );
}
