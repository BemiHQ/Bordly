import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, useMatches } from '@tanstack/react-router';
import { BoardCardState, QUERY_PARAMS } from 'bordly-backend/utils/shared';
import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BoardCardContent, BoardCardDragged, DRAG_TYPE as DRAG_TYPE_CARD } from '@/components/board/board-card';
import {
  BoardColumn,
  BoardColumnContent,
  BoardColumnDragged,
  DRAG_TYPE as DRAG_TYPE_COLUMN,
} from '@/components/board/board-column';
import { BoardNavbar } from '@/components/board/board-navbar';
import { Navbar } from '@/components/navbar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { useBoardFilters } from '@/hooks/use-board-filters';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { RouteProvider, useRouteContext } from '@/hooks/use-route-context';
import { ensureLoggedIn } from '@/loaders/authentication';
import { type BoardColumn as BoardColumnType, type BoardData, reorderBoardColumnsData } from '@/query-helpers/board';
import {
  type BoardCard,
  type BoardCardsData,
  changeBoardCardColumnData,
  removeBoardCardData,
} from '@/query-helpers/board-cards';
import { isSsr } from '@/utils/ssr';
import { cn, extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

const REFETCH_INTERVAL_MS = 30_000;

const ARCHIVE_DROP_ZONE_ID = 'archive-zone';

export const Route = createFileRoute('/boards/$boardId')({
  component: BoardComponent,
  loader: ensureLoggedIn(ROUTES.BOARD),
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
  const { currentUser } = Route.useLoaderData();
  const [activeBoardCard, setActiveBoardCard] = useState<BoardCard | null>(null);
  const [activeBoardColumn, setActiveBoardColumn] = useState<BoardColumnType | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { board, boardColumnsAsc, boardMembers } = boardData;
  const { boardCardsDesc } = boardCardsData;

  const boardCardsQueryKey = trpc.boardCard.getBoardCards.queryKey({ boardId: board.id });

  const setStateMutation = useMutation(trpc.boardCard.setState.mutationOptions());
  const optimisticallyArchiveBoardCard = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: (params) => removeBoardCardData({ trpc, queryClient, params }),
    successToast: 'Card archived',
    errorToast: 'Failed to archive the card. Please try again.',
    mutation: setStateMutation,
    undoMutationConfig: ({ boardId, boardCardId }) => ({
      mutation: setStateMutation,
      params: { boardId, boardCardId, state: BoardCardState.INBOX },
    }),
  });

  const optimisticallyMoveBoardCard = useOptimisticMutation({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: (params) => changeBoardCardColumnData({ trpc, queryClient, params }),
    errorToast: 'Failed to move the card. Please try again.',
    mutation: useMutation(trpc.boardCard.setBoardColumn.mutationOptions()),
  });

  const optimisticallyMoveBoardColumn = useOptimisticMutation({
    queryClient,
    queryKey: trpc.board.get.queryKey({ boardId: board.id }),
    onExecute: (params) => reorderBoardColumnsData({ trpc, queryClient, params }),
    errorToast: 'Failed to reorder column. Please try again.',
    mutation: useMutation(trpc.boardColumn.setPosition.mutationOptions()),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dragType = active.data.current?.type;

    if (dragType === DRAG_TYPE_CARD) {
      const boardCard = active.data.current?.boardCard as BoardCard | undefined;
      if (boardCard) {
        setActiveBoardCard(boardCard);
      }
    } else if (dragType === DRAG_TYPE_COLUMN) {
      const boardColumn = boardColumnsAsc.find((col) => col.id === active.id);
      if (boardColumn) {
        setActiveBoardColumn(boardColumn);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveBoardCard(null);
    setActiveBoardColumn(null);
    if (!over) return;

    const dragType = active.data.current?.type;

    if (dragType === DRAG_TYPE_CARD) {
      const boardCardId = active.id as string;
      const boardCard = boardCardsDesc.find((card) => card.id === boardCardId);

      if (!boardCard) return;

      if (over.id === ARCHIVE_DROP_ZONE_ID) {
        optimisticallyArchiveBoardCard({ boardId: board.id, boardCardId, state: BoardCardState.ARCHIVED });
      } else {
        const boardColumnId = over.id as string;
        if (boardCard.boardColumnId !== boardColumnId) {
          optimisticallyMoveBoardCard({ boardId: board.id, boardCardId, boardColumnId });
        }
      }
    } else if (dragType === DRAG_TYPE_COLUMN) {
      const activeId = active.id as string;
      const overId = over.id as string;
      if (activeId !== overId) {
        const newIndex = boardColumnsAsc.findIndex((col) => col.id === overId);
        optimisticallyMoveBoardColumn({ boardId: board.id, boardColumnId: activeId, position: newIndex });
      }
    }
  };

  if (boardColumnsAsc.length === 0) {
    return <EmptyState />;
  }

  const columnIds = boardColumnsAsc.map((col) => col.id);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <ArchiveDropZone isDragging={!!activeBoardCard} />
      <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
        <div className="flex overflow-x-auto p-3 gap-3">
          {boardColumnsAsc.map((boardColumn) => {
            const boardCards = boardCardsDesc.filter((card) => card.boardColumnId === boardColumn.id);

            const filteredBoardCards = boardCards?.filter((card) => {
              const hasActiveFilters = filters.unread || filters.hasAttachments || filters.draft || filters.assigned;
              if (hasActiveFilters) {
                const matchesUnread = filters.unread && card.unread;
                const matchesHasAttachments = filters.hasAttachments && card.hasAttachments;
                const matchesHasDraft = filters.draft && card.emailDraft && !card.emailDraft.generated;
                const matchesAssigned =
                  filters.assigned &&
                  card.assignedBoardMemberId &&
                  boardMembers.find((m) => m.id === card.assignedBoardMemberId)?.user.id === currentUser!.id;
                if (!matchesUnread && !matchesHasAttachments && !matchesHasDraft && !matchesAssigned) return false;
              }

              if (filters.gmailAccountIds.length > 0 && !filters.gmailAccountIds.includes(card.gmailAccountId)) {
                return false;
              }
              return true;
            });

            const unreadBoardCards = boardCards?.filter((card) => card.unread);

            return (
              <BoardColumn
                key={boardColumn.id}
                board={board}
                boardColumn={boardColumn}
                unreadBoardCardCount={unreadBoardCards?.length || 0}
                isDraggingColumn={!!activeBoardColumn}
              >
                <BoardColumnContent board={board} boardCards={filteredBoardCards} boardMembers={boardMembers} />
              </BoardColumn>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeBoardCard ? (
          <BoardCardDragged>
            <BoardCardContent boardCard={activeBoardCard} boardMembers={boardMembers} />
          </BoardCardDragged>
        ) : activeBoardColumn ? (
          <BoardColumnDragged
            boardColumn={activeBoardColumn}
            unreadBoardCardCount={
              boardCardsDesc.filter((c) => c.boardColumnId === activeBoardColumn.id && c.unread).length
            }
          >
            <BoardColumnContent
              board={board}
              boardCards={boardCardsDesc.filter((card) => card.boardColumnId === activeBoardColumn.id)}
              boardMembers={boardMembers}
              isDragOverlay
            />
          </BoardColumnDragged>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

function BoardComponent() {
  const { currentUser } = Route.useLoaderData();
  const context = Route.useRouteContext();
  const params = Route.useParams();
  const matches = useMatches();
  const navigate = Route.useNavigate();

  const { data: boardData, error } = useQuery({
    ...context.trpc.board.get.queryOptions({ boardId: extractUuid(params.boardId) }),
    refetchInterval: ({ state: { data } }) => (data?.boardColumnsAsc.length === 0 ? REFETCH_INTERVAL_MS : false),
    refetchIntervalInBackground: true,
    retry: false,
  });
  if (error && error.data?.code === 'NOT_FOUND') {
    navigate({ to: ROUTES.HOME });
  }

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
  const boardName = boardData?.board.name;
  const unreadBoardCardCount = Object.values(boardCardsData?.boardCardsDesc || []).filter((card) => card.unread).length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: add matches.length to update on nested route changes
  useEffect(() => {
    if (!boardName) {
      document.title = `Bordly`;
    } else if (unreadBoardCardCount === 0) {
      document.title = `${boardName} | Bordly`;
    } else {
      document.title = `(${unreadBoardCardCount}) ${boardName} | Bordly`;
    }
  }, [boardName, unreadBoardCardCount, matches.length]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentUser={currentUser} />
      {boardData && (
        <RouteProvider value={context}>
          <BoardNavbar
            board={boardData.board}
            boardMembers={boardData.boardMembers}
            gmailAccounts={boardData.gmailAccounts}
            currentUserId={currentUser.id}
          >
            {boardCardsData && <BoardContent boardData={boardData} boardCardsData={boardCardsData} />}
          </BoardNavbar>
        </RouteProvider>
      )}
      <Outlet />
    </div>
  );
}
