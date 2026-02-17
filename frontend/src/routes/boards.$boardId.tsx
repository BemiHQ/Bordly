import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { QUERY_PARAMS } from 'bordly-backend/utils/shared';
import { Circle, CircleDot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BoardNavbar } from '@/components/board-navbar';
import { Navbar } from '@/components/navbar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBoardFilters } from '@/hooks/use-board-filters';
import { RouteProvider, useRouteContext } from '@/hooks/use-route-context';
import { isSsr } from '@/utils/ssr';
import { cn, extractUuid } from '@/utils/strings';
import { formattedTimeAgo } from '@/utils/time';
import { ROUTES } from '@/utils/urls';

const REFETCH_INTERVAL_MS = 30_000;

type BoardData = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type Board = BoardData['board'];
type BoardColumn = BoardData['boardColumns'][number];

type BoardCardsData = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
type BoardCard = BoardCardsData['boardCards'][number];

export const Route = createFileRoute('/boards/$boardId')({
  component: Home,
  loader: async ({ context: { queryClient, trpc } }) => {
    const { currentUser } = await queryClient.ensureQueryData(trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }
    return { currentUser };
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
    <div className="flex min-w-68 w-68 h-fit max-h-[calc(100vh-120px)] flex-col gap-2 rounded-lg bg-primary-foreground p-2 border border-border shadow-sm">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-sm font-semibold">{`${boardColumn.name}`}</h2>
        {unreadBoardCardCount > 0 && (
          <div className="pt-[1px] text-xs font-bold text-semi-muted">{unreadBoardCardCount}</div>
        )}
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-thin">{children}</div>
    </div>
  );
};

const BoardCard = ({ board, boardCard }: { board: Board; boardCard: BoardCard }) => {
  const { queryClient, trpc } = useRouteContext();
  const [isHovered, setIsHovered] = useState(false);
  const unread = !!boardCard.unreadEmailMessageIds;
  const firstParticipant = boardCard.participants[0];
  const firstParticipantName = firstParticipant.name || firstParticipant.email;

  const markAsReadMutation = useMutation(
    trpc.boardCard.markAsRead.mutationOptions({
      onSuccess: ({ boardCard: updatedBoardCard }) => {
        queryClient.setQueryData(
          trpc.boardCard.getBoardCards.queryKey({ boardId: board.id }),
          (oldData: BoardCardsData | undefined) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              boardCards: oldData.boardCards.map((card) => (card.id === updatedBoardCard.id ? updatedBoardCard : card)),
            };
          },
        );
      },
    }),
  );
  const markAsUnreadMutation = useMutation(
    trpc.boardCard.markAsUnread.mutationOptions({
      onSuccess: ({ boardCard: updatedBoardCard }) => {
        queryClient.setQueryData(
          trpc.boardCard.getBoardCards.queryKey({ boardId: board.id }),
          (oldData: BoardCardsData | undefined) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              boardCards: oldData.boardCards.map((card) => (card.id === updatedBoardCard.id ? updatedBoardCard : card)),
            };
          },
        );
      },
    }),
  );

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unread) {
      markAsReadMutation.mutate({ boardId: board.id, boardCardId: boardCard.id });
    } else {
      markAsUnreadMutation.mutate({ boardId: board.id, boardCardId: boardCard.id });
    }
  };

  return (
    <Card
      className="cursor-pointer p-3 transition-shadow hover:bg-background rounded-lg shadow-xs flex flex-col gap-1.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center">
        <div className="relative w-5 h-5" style={{ perspective: '200px' }}>
          <button
            onClick={handleToggleRead}
            className="absolute left-0 transition-all duration-400 ease-in-out cursor-pointer"
            style={{
              transformStyle: 'preserve-3d',
              transform: isHovered ? 'rotateY(0deg)' : 'rotateY(180deg)',
              backfaceVisibility: 'hidden',
            }}
          >
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                {unread ? (
                  <Circle className="size-5 text-muted-foreground hover:text-primary" />
                ) : (
                  <CircleDot className="size-5 text-muted-foreground hover:text-blue-700" />
                )}
              </TooltipTrigger>
              <TooltipContent side="top">{unread ? 'Mark as read' : 'Mark as unread'}</TooltipContent>
            </Tooltip>
          </button>
          <Avatar
            size="xs"
            className="absolute left-0 transition-all duration-400 ease-in-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: isHovered ? 'rotateY(180deg)' : 'rotateY(0deg)',
              backfaceVisibility: 'hidden',
            }}
          >
            <AvatarImage src={boardCard.domain.iconUrl} alt={firstParticipantName} />
            <AvatarFallback hashForBgColor={firstParticipantName}>
              {firstParticipantName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="ml-2 text-sm flex items-center min-w-0 flex-1">
          {unread && <div className="bg-blue-500 rounded-full min-w-2 min-h-2 mr-1.5 flex-shrink-0" />}
          <div className="truncate">
            <span className={unread ? 'font-bold' : 'font-medium text-text-secondary'}>{firstParticipantName}</span>
            {boardCard.participants.length > 1 && (
              <span className="text-muted-foreground">
                ,{' '}
                {boardCard.participants
                  .slice(1)
                  .map((p) => p.name || p.email)
                  .join(', ')}
              </span>
            )}
          </div>
        </div>
        <div className="ml-1 text-2xs pt-0.5 text-muted-foreground flex-shrink-0">
          {formattedTimeAgo(boardCard.lastEventAt)}
        </div>
      </div>
      <div className={cn('text-xs truncate', unread ? 'font-medium' : 'text-text-secondary')}>{boardCard.subject}</div>
      <div className="text-xs text-muted-foreground truncate">{boardCard.snippet}</div>
    </Card>
  );
};

const BoardContent = ({ boardData, boardCardsData }: { boardData: BoardData; boardCardsData: BoardCardsData }) => {
  const { filters } = useBoardFilters();

  if (boardData.boardColumns.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex overflow-x-auto p-3 gap-3">
      {boardData.boardColumns.map((boardColumn) => {
        const boardCards = boardCardsData?.boardCards
          .filter((card) => card.boardColumnId === boardColumn.id)
          .sort((a, b) => b.lastEventAt.getTime() - a.lastEventAt.getTime());

        const filteredBoardCards = boardCards?.filter((card) => {
          const hasUnreadOrSentFilter = filters.unread || filters.sent;
          if (hasUnreadOrSentFilter) {
            const matchesUnread = filters.unread && card.unreadEmailMessageIds;
            const matchesSent = filters.sent && card.hasSent;
            if (!matchesUnread && !matchesSent) return false;
          }

          if (filters.gmailAccountIds.length > 0 && !filters.gmailAccountIds.includes(card.gmailAccountId)) {
            return false;
          }
          return true;
        });

        const unreadBoardCards = boardCards?.filter((card) => card.unreadEmailMessageIds);

        return (
          <BoardColumn
            key={boardColumn.id}
            boardColumn={boardColumn}
            unreadBoardCardCount={unreadBoardCards?.length || 0}
          >
            {filteredBoardCards?.map((boardCard) => (
              <BoardCard key={boardCard.id} board={boardData.board} boardCard={boardCard} />
            ))}
          </BoardColumn>
        );
      })}
    </div>
  );
};

function Home() {
  const { currentUser } = Route.useLoaderData();
  const context = Route.useRouteContext();
  const params = Route.useParams();

  const { data: boardData } = useQuery({
    ...context.trpc.board.getBoard.queryOptions({ boardId: extractUuid(params.boardId) }),
    refetchInterval: ({ state: { data } }) => (data?.boardColumns.length === 0 ? REFETCH_INTERVAL_MS : false),
    refetchIntervalInBackground: true,
  });

  const { data: boardCardsData } = useQuery({
    ...context.trpc.boardCard.getBoardCards.queryOptions({ boardId: extractUuid(params.boardId) }),
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  // Toast for added Gmail account
  useEffect(() => {
    const addedGmailAccount = !isSsr()
      ? new URLSearchParams(window.location.search).get(QUERY_PARAMS.ADDED_GMAIL_ACCOUNT)
      : null;

    if (addedGmailAccount === '1') {
      toast.success('Successfully added the account. Importing emails may take a couple of minutes.', {
        position: 'top-center',
      });
      const url = new URL(window.location.href);
      url.searchParams.delete(QUERY_PARAMS.ADDED_GMAIL_ACCOUNT);
      window.history.replaceState({}, document.title, url.toString());
    }
  }, []);

  // Dynamic page title
  useEffect(() => {
    const unreadBoardCardCount = Object.values(boardCardsData?.boardCards || []).filter(
      (card) => !!card.unreadEmailMessageIds,
    ).length;

    if (!boardData) {
      document.title = `Bordly`;
    } else if (unreadBoardCardCount === 0) {
      document.title = `${boardData.board.name} – Bordly`;
    } else {
      document.title = `(${unreadBoardCardCount}) ${boardData.board.name} – Bordly`;
    }
  }, [boardData, boardCardsData]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      {boardData && (
        <RouteProvider value={context}>
          <BoardNavbar board={boardData.board} gmailAccounts={boardData.gmailAccounts}>
            {boardCardsData && <BoardContent boardData={boardData} boardCardsData={boardCardsData} />}
          </BoardNavbar>
        </RouteProvider>
      )}
    </div>
  );
}
