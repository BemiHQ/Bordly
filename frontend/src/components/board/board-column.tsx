import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation } from '@tanstack/react-query';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import {
  BoardCard,
  BoardCardContent,
  BoardCardParentDragged,
  DRAG_TYPE as DRAG_TYPE_CARD,
} from '@/components/board/board-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { useRouteContext } from '@/hooks/use-route-context';
import {
  type Board,
  type BoardColumn as BoardColumnType,
  type BoardMember,
  removeBoardColumnData,
  renameBoardColumnData,
} from '@/query-helpers/board';
import type { BoardCard as BoardCardType } from '@/query-helpers/board-cards';
import { cn } from '@/utils/strings';

export const DRAG_TYPE = 'board-column';

export const BoardColumn = ({
  board,
  boardColumn,
  boardCards,
  unreadBoardCardCount,
  children,
  isDraggingColumn,
}: {
  board: Board;
  boardColumn: BoardColumnType;
  boardCards: BoardCardType[];
  unreadBoardCardCount: number;
  children: React.ReactNode;
  isDraggingColumn: boolean;
}) => {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: boardColumn.id, data: { type: DRAG_TYPE_CARD } });
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: boardColumn.id, data: { type: DRAG_TYPE } });
  const { queryClient, trpc } = useRouteContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(boardColumn.name);

  const boardQueryKey = trpc.board.get.queryKey({ boardId: board.id });

  const optimisticallySetName = useOptimisticMutation({
    queryClient,
    queryKey: boardQueryKey,
    onExecute: ({ name }) =>
      renameBoardColumnData({ trpc, queryClient, params: { boardId: board.id, boardColumnId: boardColumn.id, name } }),
    errorToast: 'Failed to rename column. Please try again.',
    mutation: useMutation(trpc.boardColumn.setName.mutationOptions()),
  });

  const createMutation = useMutation(trpc.boardColumn.create.mutationOptions());
  const optimisticallyDeleteColumn = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: boardQueryKey,
    onExecute: (params) => removeBoardColumnData({ trpc, queryClient, params }),
    successToast: 'Column deleted',
    errorToast: 'Failed to delete column. Please try again.',
    mutation: useMutation(trpc.boardColumn.delete.mutationOptions()),
    undoMutationConfig: () => ({
      mutation: createMutation,
      params: { boardId: board.id, name: boardColumn.name },
    }),
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

  const hasBoardCards = boardCards.length > 0;

  const handleDelete = () => {
    if (!hasBoardCards) {
      optimisticallyDeleteColumn({ boardId: board.id, boardColumnId: boardColumn.id });
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setSortableRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-secondary flex min-w-68 w-68 h-fit max-h-[calc(100vh-120px)] flex-col gap-1 rounded-lg border border-border transition-colors',
        isOver && !isDraggingColumn ? 'border-semi-muted' : '',
      )}
    >
      <div className="flex items-center gap-2 p-2 mt-1.5 ml-3 h-7" {...attributes} {...listeners}>
        {isEditing ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            variant="ghost"
            className="text-sm font-semibold"
            autoFocus
          />
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1">
              <h2 className="text-sm font-semibold cursor-pointer hover:text-primary" onClick={handleNameClick}>
                {editedName}
              </h2>
              {unreadBoardCardCount > 0 && (
                <Badge variant="default" size="sm">
                  {unreadBoardCardCount}
                </Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon-sm" className="size-5 p-0 focus-visible:ring-0">
                  <Ellipsis className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} disabled={hasBoardCards} className="text-sm">
                  Delete column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      <div
        className={cn(
          'flex flex-col gap-2 overflow-y-auto scrollbar-thin px-2 pb-2',
          isOver && !isDraggingColumn && 'opacity-0',
        )}
      >
        {children}
      </div>
    </div>
  );
};

export const BoardColumnDragged = ({
  boardColumn,
  unreadBoardCardCount,
  children,
}: {
  boardColumn: BoardColumnType;
  unreadBoardCardCount: number;
  children: React.ReactNode;
}) => {
  return (
    <div
      className="bg-secondary min-w-68 w-68 h-fit max-h-[calc(100vh-120px)] flex flex-col gap-2 rounded-lg p-2 border border-border shadow-lg cursor-grabbing"
      style={{ transform: 'rotate(3deg)' }}
    >
      <div className="flex items-center gap-2 px-1 min-h-7">
        <h2 className="ml-[9px] pt-0.5 text-sm font-semibold">{boardColumn.name}</h2>
        {unreadBoardCardCount > 0 && (
          <Badge variant="default" size="sm">
            {unreadBoardCardCount}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-thin">{children}</div>
    </div>
  );
};

export const BoardColumnContent = ({
  board,
  boardCards,
  boardMembers,
  isDragOverlay = false,
}: {
  board: Board;
  boardCards: BoardCardType[];
  boardMembers: BoardMember[];
  isDragOverlay?: boolean;
}) => (
  <>
    {boardCards.map((boardCard) =>
      isDragOverlay ? (
        <BoardCardParentDragged key={boardCard.id}>
          <BoardCardContent boardCard={boardCard} boardMembers={boardMembers} />
        </BoardCardParentDragged>
      ) : (
        <BoardCard key={boardCard.id} board={board} boardCard={boardCard} boardMembers={boardMembers} />
      ),
    )}
  </>
);
