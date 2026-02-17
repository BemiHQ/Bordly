import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { BoardCardState, QUERY_PARAMS } from 'bordly-backend/utils/shared';
import { Archive, Mail, MailCheck, Mails, Paperclip, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BoardNavbar } from '@/components/board-navbar';
import { Navbar } from '@/components/navbar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useBoardFilters } from '@/hooks/use-board-filters';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { RouteProvider, useRouteContext } from '@/hooks/use-route-context';
import { isSsr } from '@/utils/ssr';
import { cn, extractUuid } from '@/utils/strings';
import { formattedTimeAgo } from '@/utils/time';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

const REFETCH_INTERVAL_MS = 30_000;

const ARCHIVE_DROP_ZONE_ID = 'archive-zone';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
type Board = BoardData['board'];
type BoardColumn = BoardData['boardColumns'][number];

type BoardCardsData = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
type BoardCard = BoardCardsData['boardCards'][number];

export const Route = createFileRoute('/boards/$boardId')({
  component: BoardComponent,
  loader: async ({ context: { queryClient, trpc } }) => {
    const { currentUser, boards } = await queryClient.ensureQueryData(trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (boards.length === 0) {
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
  const { setNodeRef, isOver } = useDroppable({ id: boardColumn.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-secondary flex min-w-68 w-68 h-fit max-h-[calc(100vh-120px)] flex-col gap-2 rounded-lg p-2 border border-border transition-colors',
        isOver ? 'border-semi-muted' : '',
      )}
    >
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-sm font-semibold">{`${boardColumn.name}`}</h2>
        {unreadBoardCardCount > 0 && (
          <Badge variant="default" size="sm">
            {unreadBoardCardCount}
          </Badge>
        )}
      </div>
      <div className={cn('flex flex-col gap-2 overflow-y-auto scrollbar-thin', isOver && 'opacity-0')}>{children}</div>
    </div>
  );
};

const BoardCardContent = ({
  boardCard,
  unread,
  isHovered,
  onToggleReadStatus,
}: {
  boardCard: BoardCard;
  unread: boolean;
  isHovered?: boolean;
  onToggleReadStatus?: (e: React.MouseEvent) => void;
}) => {
  const firstParticipant = boardCard.participants[0];
  const firstParticipantName = firstParticipant.name || firstParticipant.email;

  const { iconUrl } = boardCard.domain;

  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-1.5">
        <Avatar
          size="xs"
          className={cn(
            'transition-filter duration-200',
            unread || isHovered === true || isHovered === undefined ? '' : 'grayscale-100 opacity-60',
          )}
        >
          <AvatarImage
            src={
              iconUrl && !iconUrl.startsWith('/')
                ? `${API_ENDPOINTS.PROXY_ICON}?url=${encodeURIComponent(iconUrl!)}`
                : iconUrl
            }
            alt={firstParticipantName}
          />
          <AvatarFallback hashForBgColor={firstParticipantName}>
            {firstParticipantName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="mx-2 text-sm flex items-center min-w-0 flex-1">
          {unread && <div className="bg-blue-500 rounded-full min-w-2 min-h-2 mr-1.5 flex-shrink-0" />}
          <div className="truncate">
            <span className={unread ? 'font-bold' : 'font-medium'}>{firstParticipantName}</span>
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
        {isHovered && onToggleReadStatus ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleReadStatus}
                className={cn(
                  'cursor-pointer p-0.5',
                  unread ? 'text-primary' : 'text-muted-foreground hover:text-primary',
                )}
              >
                {unread ? <MailCheck className="size-4" /> : <Mail className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{unread ? 'Mark as read' : 'Mark as unread'}</TooltipContent>
          </Tooltip>
        ) : (
          <div
            className={cn(
              'text-2xs pt-0.5 text-muted-foreground text-right',
              isHovered && onToggleReadStatus ? 'opacity-0' : 'opacity-100',
            )}
          >
            {formattedTimeAgo(boardCard.lastEventAt)}
          </div>
        )}
      </div>
      <div className={cn('text-xs truncate mb-1', unread ? 'font-medium' : 'text-text-secondary')}>
        {boardCard.subject}
      </div>
      <div className="text-xs text-muted-foreground truncate">{boardCard.snippet}</div>
      {(boardCard.hasSent || boardCard.hasAttachments || boardCard.emailMessageCount > 1) && (
        <div className="flex items-center gap-3 mt-1 text-2xs text-muted-foreground">
          {boardCard.hasSent && <Send className="size-3" />}
          {boardCard.hasAttachments && <Paperclip className="size-3" />}
          {boardCard.emailMessageCount > 1 && (
            <div className="flex items-center gap-1">
              <Mails className="size-3.5" />
              <span>{boardCard.emailMessageCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BoardCard = ({ board, boardCard }: { board: Board; boardCard: BoardCard }) => {
  const { queryClient, trpc } = useRouteContext();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const unread = !!boardCard.unreadEmailMessageIds;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: boardCard.id,
    data: { boardCard },
  });

  const boardCardsQueryKey = trpc.boardCard.getBoardCards.queryKey({ boardId: board.id });

  const updateBoardCardCache = ({ boardCard }: { boardCard: BoardCard }) => {
    queryClient.setQueryData(
      trpc.boardCard.getBoardCards.queryKey({ boardId: board.id }),
      (oldData: BoardCardsData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCards: oldData.boardCards.map((card) => (card.id === boardCard.id ? boardCard : card)),
        };
      },
    );
  };
  const optimisticallyMarkAsRead = useOptimisticMutation({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId }) => {
      queryClient.setQueryData(boardCardsQueryKey, (oldData: BoardCardsData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCards: oldData.boardCards.map((c) =>
            c.id === boardCardId ? { ...c, unreadEmailMessageIds: undefined } : c,
          ),
        };
      });
    },
    onSuccess: updateBoardCardCache,
    errorToast: 'Failed to mark the card as read. Please try again.',
    mutation: useMutation(trpc.boardCard.markAsRead.mutationOptions()),
  });

  const optimisticallyMarkAsUnread = useOptimisticMutation({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId }) => {
      queryClient.setQueryData(boardCardsQueryKey, (oldData: BoardCardsData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCards: oldData.boardCards.map((c) =>
            c.id === boardCardId ? { ...c, unreadEmailMessageIds: ['temp-id'] } : c,
          ),
        };
      });
    },
    onSuccess: updateBoardCardCache,
    errorToast: 'Failed to mark the card as unread. Please try again.',
    mutation: useMutation(trpc.boardCard.markAsUnread.mutationOptions()),
  });

  const handleToggleReadStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unread) {
      optimisticallyMarkAsRead({ boardId: board.id, boardCardId: boardCard.id });
    } else {
      optimisticallyMarkAsUnread({ boardId: board.id, boardCardId: boardCard.id });
    }
    setIsHovered(false);
  };

  const handleCardClick = () => {
    navigate({ to: ROUTES.BOARD_CARD.replace('$boardId', board.friendlyId).replace('$boardCardId', boardCard.id) });
  };

  return (
    <Card
      ref={setNodeRef}
      style={isDragging ? { opacity: 0 } : undefined}
      {...attributes}
      {...listeners}
      className={`p-3 transition-shadow rounded-lg shadow-xs cursor-pointer ${isHovered ? 'border-semi-muted' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <BoardCardContent
        boardCard={boardCard}
        unread={unread}
        isHovered={isHovered}
        onToggleReadStatus={handleToggleReadStatus}
      />
    </Card>
  );
};

const ArchiveDropZone = ({ isDragging }: { isDragging: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id: ARCHIVE_DROP_ZONE_ID });

  return (
    <>
      <div
        className={cn(
          'bg-background fixed top-0 left-0 right-0 h-[94px] z-50',
          isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      <div
        ref={setNodeRef}
        className={cn(
          'bg-secondary fixed top-0 left-0 right-0 h-[94px] z-50 flex items-center justify-center border-y rounded-lg',
          isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none',
          isOver ? 'border-semi-muted border' : 'border-t-border',
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Archive className="size-4" />
          <span>Drop here to archive</span>
        </div>
      </div>
    </>
  );
};

const BoardContent = ({ boardData, boardCardsData }: { boardData: BoardData; boardCardsData: BoardCardsData }) => {
  const { filters } = useBoardFilters();
  const { queryClient, trpc } = useRouteContext();
  const [activeBoardCard, setActiveBoardCard] = useState<BoardCard | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const boardCardsQueryKey = trpc.boardCard.getBoardCards.queryKey({ boardId: boardData.board.id });

  const optimisticallyArchive = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId }) => {
      queryClient.setQueryData(boardCardsQueryKey, (oldData: BoardCardsData | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, boardCards: oldData.boardCards.filter((card) => card.id !== boardCardId) };
      });
    },
    successToast: 'Card archived',
    errorToast: 'Failed to archive the card. Please try again.',
    delayedMutation: useMutation(trpc.boardCard.setState.mutationOptions()),
  });

  const optimisticallyMove = useOptimisticMutation({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId, boardColumnId }) => {
      queryClient.setQueryData(boardCardsQueryKey, (oldData: BoardCardsData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCards: oldData.boardCards.map((card) => (card.id === boardCardId ? { ...card, boardColumnId } : card)),
        };
      });
    },
    errorToast: 'Failed to move the card. Please try again.',
    mutation: useMutation(trpc.boardCard.setBoardColumn.mutationOptions()),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const boardCard = active.data.current?.boardCard as BoardCard | undefined;
    if (boardCard) {
      setActiveBoardCard(boardCard);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBoardCard(null);
    if (!over) return;

    const boardCardId = active.id as string;
    const boardCard = boardCardsData.boardCards.find((card) => card.id === boardCardId);

    if (!boardCard) return;

    if (over.id === ARCHIVE_DROP_ZONE_ID) {
      optimisticallyArchive({ boardId: boardData.board.id, boardCardId, state: BoardCardState.ARCHIVED });
    } else {
      const boardColumnId = over.id as string;
      if (boardCard.boardColumnId !== boardColumnId) {
        optimisticallyMove({ boardId: boardData.board.id, boardCardId, boardColumnId });
      }
    }
  };

  if (boardData.boardColumns.length === 0) {
    return <EmptyState />;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ArchiveDropZone isDragging={!!activeBoardCard} />
      <div className="flex overflow-x-auto p-3 gap-3">
        {boardData.boardColumns.map((boardColumn) => {
          const boardCards = boardCardsData?.boardCards
            .filter((card) => card.boardColumnId === boardColumn.id)
            .sort((a, b) => b.lastEventAt.getTime() - a.lastEventAt.getTime());

          const filteredBoardCards = boardCards?.filter((card) => {
            const hasActiveFilters = filters.unread || filters.sent || filters.hasAttachments;
            if (hasActiveFilters) {
              const matchesUnread = filters.unread && card.unreadEmailMessageIds;
              const matchesSent = filters.sent && card.hasSent;
              const matchesHasAttachments = filters.hasAttachments && card.hasAttachments;
              if (!matchesUnread && !matchesSent && !matchesHasAttachments) return false;
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
      <DragOverlay dropAnimation={null}>
        {activeBoardCard ? (
          <Card className="cursor-grabbing p-3 rounded-lg shadow-lg w-64" style={{ transform: 'rotate(5deg)' }}>
            <BoardCardContent boardCard={activeBoardCard} unread={!!activeBoardCard.unreadEmailMessageIds} />
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

function BoardComponent() {
  const { currentUser } = Route.useLoaderData();
  const context = Route.useRouteContext();
  const params = Route.useParams();

  const { data: boardData } = useQuery({
    ...context.trpc.board.get.queryOptions({ boardId: extractUuid(params.boardId) }),
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
          <BoardNavbar board={boardData.board} gmailAccounts={boardData.gmailAccounts} currentUserId={currentUser.id}>
            {boardCardsData && <BoardContent boardData={boardData} boardCardsData={boardCardsData} />}
          </BoardNavbar>
        </RouteProvider>
      )}
      <Outlet />
    </div>
  );
}
