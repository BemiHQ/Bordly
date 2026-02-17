import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { BoardCardState } from 'bordly-backend/utils/shared';
import { Archive, Mail, OctagonX, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import type { RouteContext } from '@/hooks/use-route-context';
import { ROUTES } from '@/utils/urls';

type EmailMessagesData = inferRouterOutputs<TRPCRouter>['emailMessage']['getEmailMessages'];
type BoardCard = EmailMessagesData['boardCard'];
type BoardColumn = EmailMessagesData['boardColumn'];

export const BoardCardDialogNavbar = ({
  context,
  boardId,
  boardCardId,
  boardColumn,
}: {
  context: RouteContext;
  boardId: string;
  boardCardId: string;
  boardColumn: BoardColumn;
}) => {
  const navigate = useNavigate();

  const emailMessagesQueryKey = context.trpc.emailMessage.getEmailMessages.queryKey({ boardId, boardCardId });
  const boardCardsQueryKey = context.trpc.boardCard.getBoardCards.queryKey({ boardId });

  const optimisticallySetBoardColumn = useOptimisticMutation({
    queryClient: context.queryClient,
    queryKey: emailMessagesQueryKey,
    onExecute: ({ boardColumnId }: { boardColumnId: string }) => {
      const newBoardColumn = boardColumnsAsc.find((col) => col.id === boardColumnId);
      if (!newBoardColumn) return;

      context.queryClient.setQueryData(emailMessagesQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, boardColumn: newBoardColumn } satisfies typeof oldData;
      });

      context.queryClient.setQueryData(boardCardsQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCardId ? { ...c, boardColumnId } : c)),
        } satisfies typeof oldData;
      });
    },
    errorToast: 'Failed to change column. Please try again.',
    mutation: useMutation(context.trpc.boardCard.setBoardColumn.mutationOptions()),
  });

  const optimisticallyMarkAsUnread = useOptimisticMutation({
    queryClient: context.queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId }) => {
      context.queryClient.setQueryData(boardCardsQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.map((c) =>
            c.id === boardCardId ? { ...c, unreadEmailMessageIds: ['temp-id'] } : c,
          ),
        } satisfies typeof oldData;
      });
    },
    onSuccess: ({ boardCard }: { boardCard: BoardCard }) => {
      context.queryClient.setQueryData(boardCardsQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.map((card) => (card.id === boardCard.id ? boardCard : card)),
        } satisfies typeof oldData;
      });
    },
    errorToast: 'Failed to mark the card as unread. Please try again.',
    mutation: useMutation(context.trpc.boardCard.markAsUnread.mutationOptions()),
  });

  const optimisticallyArchive = useOptimisticMutationWithUndo({
    queryClient: context.queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId }) => {
      context.queryClient.setQueryData(boardCardsQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.filter((card) => card.id !== boardCardId),
        } satisfies typeof oldData;
      });
    },
    successToast: 'Card archived',
    errorToast: 'Failed to archive the card. Please try again.',
    delayedMutation: useMutation(context.trpc.boardCard.setState.mutationOptions()),
  });

  const optimisticallyMarkAsSpam = useOptimisticMutationWithUndo({
    queryClient: context.queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId }) => {
      context.queryClient.setQueryData(boardCardsQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.filter((card) => card.id !== boardCardId),
        } satisfies typeof oldData;
      });
    },
    successToast: 'Card marked as spam',
    errorToast: 'Failed to mark the card as spam. Please try again.',
    delayedMutation: useMutation(context.trpc.boardCard.setState.mutationOptions()),
  });

  const optimisticallyDelete = useOptimisticMutationWithUndo({
    queryClient: context.queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardCardId }) => {
      context.queryClient.setQueryData(boardCardsQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.filter((card) => card.id !== boardCardId),
        } satisfies typeof oldData;
      });
    },
    successToast: 'Card deleted',
    errorToast: 'Failed to delete the card. Please try again.',
    delayedMutation: useMutation(context.trpc.boardCard.setState.mutationOptions()),
  });

  const { data: boardData } = useQuery({ ...context.trpc.board.get.queryOptions({ boardId }) });
  if (!boardData) return <div className="h-8" />;

  const { boardColumnsAsc } = boardData;

  return (
    <div className="flex gap-8 items-center">
      <Select
        value={boardColumn?.id}
        onValueChange={(value) => optimisticallySetBoardColumn({ boardId, boardCardId, boardColumnId: value })}
      >
        <SelectTrigger
          className="text-sm font-medium text-muted-foreground hover:text-accent-foreground border-0 p-0 shadow-none focus-visible:!ring-0 !h-auto"
          hideChevron
        >
          <SelectValue placeholder={boardColumn?.name} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {boardColumnsAsc.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                {col.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                optimisticallyArchive({ boardId, boardCardId, state: BoardCardState.ARCHIVED });
                navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
              }}
              className="flex text-muted-foreground cursor-pointer hover:bg-border"
            >
              <Archive className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Archive</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                optimisticallyMarkAsSpam({ boardId, boardCardId, state: BoardCardState.SPAM });
                navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
              }}
              className="flex text-muted-foreground cursor-pointer hover:bg-border"
            >
              <OctagonX className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Report spam</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                optimisticallyDelete({ boardId, boardCardId, state: BoardCardState.TRASH });
                navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
              }}
              className="flex text-muted-foreground cursor-pointer hover:bg-border"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Delete</TooltipContent>
        </Tooltip>
        <div className="w-px h-4 bg-ring mx-0.5" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                optimisticallyMarkAsUnread({ boardId, boardCardId });
                navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
              }}
              className="flex text-muted-foreground cursor-pointer hover:bg-border"
            >
              <Mail className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mark as unread</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
