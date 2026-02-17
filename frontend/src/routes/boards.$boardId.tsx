import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { ListFilter } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Navbar } from '@/components/navbar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formattedTimeAgo } from '@/utils/dates';
import { isSsr } from '@/utils/ssr';
import { cn, extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

const LOCAL_STORAGE_KEY_SHOW_UNREAD_ONLY = 'showUnreadOnly';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type Board = BoardData['board'];
type BoardColumn = BoardData['boardColumns'][number];

type BoardCardsData = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
type BoardCard = BoardCardsData['boardCards'][number];
type EmailMessagesByThreadId = BoardCardsData['emailMessagesByThreadId'];
type EmailMessage = EmailMessagesByThreadId[number][number];
type GmailAccount = BoardCardsData['gmailAccounts'][number];

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

    const boardData = await context.queryClient.ensureQueryData(
      context.trpc.board.getBoard.queryOptions({ boardId: extractUuid(params.boardId) }),
    );

    return { currentUser, boardData };
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

const BoardNavbar = ({
  board,
  showUnreadOnly,
  setShowUnreadOnly,
}: {
  board: Board;
  showUnreadOnly: boolean;
  setShowUnreadOnly: (value: boolean) => void;
}) => {
  return (
    <div className="border-b bg-background px-6 py-2.5 flex items-center justify-between">
      <h1 className="font-semibold">{board.name}</h1>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={showUnreadOnly ? 'bg-border hover:bg-border' : ''}
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            <ListFilter className="text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{showUnreadOnly ? 'Show all emails' : 'Show unread emails only'}</TooltipContent>
      </Tooltip>
    </div>
  );
};

const BoardColumn = ({
  boardColumn,
  boardCards,
  emailMessagesByThreadId,
  children,
}: {
  boardColumn: BoardColumn;
  boardCards: BoardCard[] | undefined;
  emailMessagesByThreadId: EmailMessagesByThreadId | undefined;
  children: React.ReactNode;
}) => {
  const unreadThreadCount =
    boardCards && emailMessagesByThreadId
      ? boardCards.filter((card) => emailMessagesByThreadId[card.externalThreadId].some((msg) => !msg.read)).length
      : 0;

  return (
    <div className="flex min-w-68 w-68 h-fit max-h-[calc(100vh-116px)] flex-col gap-2 rounded-lg bg-primary-foreground p-2 border border-border scrollbar-thin overflow-y-auto shadow-sm">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-sm font-semibold">{`${boardColumn.name}`}</h2>
        {unreadThreadCount > 0 && <div className="pt-[1px] text-xs font-bold text-semi-muted">{unreadThreadCount}</div>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
};

const BoardCard = ({
  boardCard: _boardCard,
  showUnreadOnly,
  gmailAccounts,
  domainIconUrlByName,
  emailMessages,
}: {
  boardCard: BoardCard;
  showUnreadOnly: boolean;
  gmailAccounts: GmailAccount[];
  domainIconUrlByName: Record<string, string>;
  emailMessages: EmailMessage[];
}) => {
  const anyUnread = emailMessages.some((msg) => !msg.read);
  if (showUnreadOnly && !anyUnread) {
    return null;
  }

  const title = emailMessages.find((msg) => msg.subject)?.subject || 'No subject';
  const snippet = emailMessages[emailMessages.length - 1]?.snippet || 'Empty';
  const participants = emailMessages
    .flatMap((msg) =>
      msg.sent
        ? [...(msg.to || []), ...(msg.cc || []), ...(msg.bcc || [])]
        : [msg.from, ...(msg.to || []), ...(msg.cc || [])],
    )
    .filter((p) => !gmailAccounts.some((account) => p.email === account.email));

  const lastSentAt = emailMessages.reduce((latest, message) => {
    const messageDate = new Date(message.externalCreatedAt);
    return messageDate > latest ? messageDate : latest;
  }, new Date(0));

  return (
    <Card className="cursor-pointer p-3 transition-shadow hover:bg-background rounded-lg shadow-xs flex flex-col gap-1.5">
      <div className="flex items-center">
        <Avatar size="xs">
          <AvatarImage
            src={domainIconUrlByName[participants[0].email.split('@')[1]]}
            alt={participants[0].name || participants[0].email}
          />
          <AvatarFallback hashForBgColor={participants[0].email}>
            {(participants[0].name || participants[0].email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="ml-2 text-sm flex items-center min-w-0 flex-1">
          {anyUnread && <div className="bg-blue-500 rounded-full min-w-2 min-h-2 mr-1.5 flex-shrink-0" />}
          <div className="truncate">
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
        <div className="ml-1 text-2xs pt-0.5 text-muted-foreground flex-shrink-0">{formattedTimeAgo(lastSentAt)}</div>
      </div>
      <div className={cn('text-xs truncate', anyUnread && 'font-medium')}>{title}</div>
      <div className="text-xs text-muted-foreground truncate">{snippet}</div>
    </Card>
  );
};

function Home() {
  const { currentUser, boardData } = Route.useLoaderData();
  const { board, boardColumns } = boardData;

  const context = Route.useRouteContext();
  const params = Route.useParams();
  const { data: boardCardsData } = useQuery(
    context.trpc.boardCard.getBoardCards.queryOptions({ boardId: extractUuid(params.boardId) }),
  );
  const [showUnreadOnly, setShowUnreadOnly] = useState(() => {
    const saved = !isSsr() && localStorage.getItem(LOCAL_STORAGE_KEY_SHOW_UNREAD_ONLY);
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    if (!isSsr()) {
      localStorage.setItem(LOCAL_STORAGE_KEY_SHOW_UNREAD_ONLY, JSON.stringify(showUnreadOnly));
    }
  }, [showUnreadOnly]);

  useEffect(() => {
    const unreadThreadCount = Object.values(boardCardsData?.emailMessagesByThreadId || {}).filter((messages) =>
      messages.some((msg) => !msg.read),
    ).length;

    if (unreadThreadCount === 0) {
      document.title = `${board.name} – Bordly`;
    } else {
      document.title = `(${unreadThreadCount}) ${board.name} – Bordly`;
    }
  }, [board.name, boardCardsData]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      <BoardNavbar board={board} showUnreadOnly={showUnreadOnly} setShowUnreadOnly={setShowUnreadOnly} />
      {boardColumns.length === 0 && <EmptyState />}
      {boardColumns.length > 0 && (
        <div className="flex overflow-x-auto p-3 gap-3">
          {boardColumns.map((boardColumn) => {
            const boardCards = boardCardsData?.boardCards.filter((card) => card.boardColumnId === boardColumn.id);
            return (
              <BoardColumn
                key={boardColumn.id}
                boardColumn={boardColumn}
                boardCards={boardCards}
                emailMessagesByThreadId={boardCardsData?.emailMessagesByThreadId}
              >
                {boardCards?.map((boardCard) => (
                  <BoardCard
                    key={boardCard.id}
                    boardCard={boardCard}
                    showUnreadOnly={showUnreadOnly}
                    gmailAccounts={boardCardsData!.gmailAccounts}
                    domainIconUrlByName={boardCardsData!.domainIconUrlByName}
                    emailMessages={boardCardsData!.emailMessagesByThreadId[boardCard.externalThreadId]}
                  />
                ))}
              </BoardColumn>
            );
          })}
        </div>
      )}
    </div>
  );
}
