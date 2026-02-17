import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { BoardCardState, QUERY_PARAMS } from 'bordly-backend/utils/shared';
import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BoardCard, BoardCardContent } from '@/components/board-card';
import { BoardNavbar } from '@/components/board-navbar';
import { Navbar } from '@/components/navbar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useBoardFilters } from '@/hooks/use-board-filters';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { RouteProvider, useRouteContext } from '@/hooks/use-route-context';
import { isSsr } from '@/utils/ssr';
import { cn, extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

const REFETCH_INTERVAL_MS = 30_000;

const ARCHIVE_DROP_ZONE_ID = 'archive-zone';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
type Board = BoardData['board'];
type BoardColumn = BoardData['boardColumns'][number];

type BoardCardsData = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
type BoardCardType = BoardCardsData['boardCards'][number];

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
  board,
  boardColumn,
  unreadBoardCardCount,
  children,
}: {
  board: Board;
  boardColumn: BoardColumn;
  unreadBoardCardCount: number;
  children: React.ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: boardColumn.id });
  const { queryClient, trpc } = useRouteContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(boardColumn.name);

  const boardQueryKey = trpc.board.get.queryKey({ boardId: board.id });

  const optimisticallySetName = useOptimisticMutation({
    queryClient,
    queryKey: boardQueryKey,
    onExecute: ({ name }) => {
      queryClient.setQueryData(boardQueryKey, (oldData: BoardData | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardColumns: oldData.boardColumns.map((col) => (col.id === boardColumn.id ? { ...col, name } : col)),
        };
      });
    },
    errorToast: 'Failed to rename column. Please try again.',
    mutation: useMutation(trpc.boardColumn.setName.mutationOptions()),
  });

  const handleNameClick = () => {
    setIsEditing(true);
    setEditedName(boardColumn.name);
  };

  const handleNameSubmit = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== boardColumn.name) {
      optimisticallySetName({ boardId: board.id, boardColumnId: boardColumn.id, name: trimmedName });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedName(boardColumn.name);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-secondary flex min-w-68 w-68 h-fit max-h-[calc(100vh-120px)] flex-col gap-2 rounded-lg p-2 border border-border transition-colors',
        isOver ? 'border-semi-muted' : '',
      )}
    >
      <div className="flex items-center gap-2 px-1 min-h-7">
        {isEditing ? (
          <Input
            inputSize="sm"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className="bg-background px-2 mt-0.5 h-6.5 text-sm font-semibold rounded-sm focus-visible:ring-1"
            autoFocus
          />
        ) : (
          <h2
            className="ml-[9px] pt-0.5 text-sm font-semibold cursor-pointer hover:text-primary w-full"
            onClick={handleNameClick}
          >
            {editedName}
          </h2>
        )}
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
  const [activeBoardCard, setActiveBoardCard] = useState<BoardCardType | null>(null);
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
    const boardCard = active.data.current?.boardCard as BoardCardType | undefined;
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
              board={boardData.board}
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
