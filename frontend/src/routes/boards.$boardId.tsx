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
import { isSsr } from '@/utils/ssr';
import { cn, extractUuid } from '@/utils/strings';
import { formattedTimeAgo } from '@/utils/time';
import { ROUTES } from '@/utils/urls';

const LOCAL_STORAGE_KEY_SHOW_UNREAD_ONLY = 'showUnreadOnly';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type Board = BoardData['board'];
type BoardColumn = BoardData['boardColumns'][number];

type BoardCardsData = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
type BoardCard = BoardCardsData['boardCards'][number];

export const Route = createFileRoute('/boards/$boardId')({
  component: Home,
  loader: async ({ context, params }) => {
    const { currentUser } = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
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
      <EmptyDescription>Please wait while we set up your board. This may take a couple of minutes.</EmptyDescription>
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
  unreadBoardCardCount,
  children,
}: {
  boardColumn: BoardColumn;
  unreadBoardCardCount: number;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex min-w-68 w-68 h-fit max-h-[calc(100vh-116px)] flex-col gap-2 rounded-lg bg-primary-foreground p-2 border border-border scrollbar-thin overflow-y-auto shadow-sm">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-sm font-semibold">{`${boardColumn.name}`}</h2>
        {unreadBoardCardCount > 0 && (
          <div className="pt-[1px] text-xs font-bold text-semi-muted">{unreadBoardCardCount}</div>
        )}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
};

const BoardCard = ({ boardCard }: { boardCard: BoardCard }) => {
  const unread = !!boardCard.unreadEmailMessageIds;
  const firstParticipantName = boardCard.participantNames[0];

  return (
    <Card className="cursor-pointer p-3 transition-shadow hover:bg-background rounded-lg shadow-xs flex flex-col gap-1.5">
      <div className="flex items-center">
        <Avatar size="xs">
          <AvatarImage src={boardCard.domain.iconUrl} alt={firstParticipantName} />
          <AvatarFallback hashForBgColor={firstParticipantName}>
            {firstParticipantName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="ml-2 text-sm flex items-center min-w-0 flex-1">
          {unread && <div className="bg-blue-500 rounded-full min-w-2 min-h-2 mr-1.5 flex-shrink-0" />}
          <div className="truncate">
            <span className={unread ? 'font-bold' : 'font-medium'}>{firstParticipantName}</span>
            {boardCard.participantNames.length > 1 && (
              <span className="text-muted-foreground">, {boardCard.participantNames.slice(1).join(', ')}</span>
            )}
          </div>
        </div>
        <div className="ml-1 text-2xs pt-0.5 text-muted-foreground flex-shrink-0">
          {formattedTimeAgo(boardCard.lastEventAt)}
        </div>
      </div>
      <div className={cn('text-xs truncate', unread && 'font-medium')}>{boardCard.subject}</div>
      <div className="text-xs text-muted-foreground truncate">{boardCard.snippet}</div>
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

  // Filter
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
    const unreadBoardCardCount = Object.values(boardCardsData?.boardCards || []).filter(
      (card) => !!card.unreadEmailMessageIds,
    ).length;

    if (unreadBoardCardCount === 0) {
      document.title = `${board.name} – Bordly`;
    } else {
      document.title = `(${unreadBoardCardCount}) ${board.name} – Bordly`;
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
            const boardCards = boardCardsData?.boardCards
              .filter((card) => card.boardColumnId === boardColumn.id)
              .sort((a, b) => b.lastEventAt.getTime() - a.lastEventAt.getTime());

            const unreadBoardCards = boardCards?.filter((card) => card.unreadEmailMessageIds);

            return (
              <BoardColumn
                key={boardColumn.id}
                boardColumn={boardColumn}
                unreadBoardCardCount={unreadBoardCards?.length || 0}
              >
                {(showUnreadOnly ? unreadBoardCards : boardCards)?.map((boardCard) => (
                  <BoardCard key={boardCard.id} boardCard={boardCard} />
                ))}
              </BoardColumn>
            );
          })}
        </div>
      )}
    </div>
  );
}
