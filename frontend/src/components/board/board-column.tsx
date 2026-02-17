import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  BoardCard,
  BoardCardContent,
  BoardCardParentDragged,
  DRAG_TYPE as DRAG_TYPE_CARD,
} from '@/components/board/board-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useRouteContext } from '@/hooks/use-route-context';
import {
  type Board,
  type BoardColumn as BoardColumnType,
  type BoardMember,
  renameBoardColumnData,
} from '@/query-helpers/board';
import type { BoardCard as BoardCardType } from '@/query-helpers/board-cards';
import { cn } from '@/utils/strings';

export const DRAG_TYPE = 'board-column';

export const BoardColumn = ({
  board,
  boardColumn,
  unreadBoardCardCount,
  children,
  isDraggingColumn,
}: {
  board: Board;
  boardColumn: BoardColumnType;
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

  const optimisticallySetName = useOptimisticMutation({
    queryClient,
    queryKey: trpc.board.get.queryKey({ boardId: board.id }),
    onExecute: ({ name }) =>
      renameBoardColumnData({ trpc, queryClient, params: { boardId: board.id, boardColumnId: boardColumn.id, name } }),
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
        'bg-secondary flex min-w-68 w-68 h-fit max-h-[calc(100vh-120px)] flex-col gap-2 rounded-lg p-2 border border-border transition-colors',
        isOver && !isDraggingColumn ? 'border-semi-muted' : '',
      )}
    >
      <div className="flex items-center gap-2 px-1 min-h-7" {...attributes} {...listeners}>
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
      <div
        className={cn('flex flex-col gap-2 overflow-y-auto scrollbar-thin', isOver && !isDraggingColumn && 'opacity-0')}
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
