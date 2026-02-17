import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BoardCardState, BoardMemberRole } from 'bordly-backend/utils/shared';
import { Archive, Mail, OctagonX, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import type { RouteContext } from '@/hooks/use-route-context';
import { type BoardCard, type BoardColumn, replaceBoardColumnData } from '@/query-helpers/board-card';
import { changeBoardCardColumnData, removeBoardCardData, setUnreadBoardCardData } from '@/query-helpers/board-cards';
import { ROUTES } from '@/utils/urls';

export const BoardCardDialogNavbar = ({
  context,
  boardId,
  boardCard,
  boardColumn,
}: {
  context: RouteContext;
  boardId: string;
  boardCard: BoardCard;
  boardColumn: BoardColumn;
}) => {
  const { trpc, queryClient } = context;
  const navigate = useNavigate();

  const { data: boardData } = useQuery({ ...trpc.board.get.queryOptions({ boardId }) });
  const boardColumnsAsc = boardData?.boardColumnsAsc ?? [];
  const boardMembers = boardData?.boardMembers ?? [];

  const boardCardId = boardCard.id;
  const participantMembers = boardMembers.filter((m) => boardCard.participantUserIds?.includes(m.user.id));
  const assignedMember = boardMembers.find((m) => m.id === boardCard.assignedBoardMemberId);

  const boardCardQueryKey = trpc.boardCard.get.queryKey({ boardId, boardCardId });
  const optimisticallySetAssignee = useOptimisticMutation({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: () => {},
    errorToast: 'Failed to update assignee. Please try again.',
    mutation: useMutation(trpc.boardCard.setAssignee.mutationOptions()),
  });
  const optimisticallySetBoardColumn = useOptimisticMutation({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: (params) => {
      const boardColumn = boardColumnsAsc.find((col) => col.id === params.boardColumnId)!;
      replaceBoardColumnData({
        trpc: trpc,
        queryClient,
        params: { ...params, boardColumn },
      });
      changeBoardCardColumnData({ trpc: trpc, queryClient, params });
    },
    errorToast: 'Failed to change column. Please try again.',
    mutation: useMutation(trpc.boardCard.setBoardColumn.mutationOptions()),
  });

  const boardCardsQueryKey = trpc.boardCard.getBoardCards.queryKey({ boardId });
  const setStateMutation = useMutation(trpc.boardCard.setState.mutationOptions());
  const optimisticallyArchive = useOptimisticMutationWithUndo({
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
  const optimisticallyMarkAsSpam = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: (params) => removeBoardCardData({ trpc, queryClient, params }),
    successToast: 'Card marked as spam',
    errorToast: 'Failed to mark the card as spam. Please try again.',
    mutation: setStateMutation,
    undoMutationConfig: ({ boardId, boardCardId }) => ({
      mutation: setStateMutation,
      params: { boardId, boardCardId, state: BoardCardState.INBOX },
    }),
  });
  const optimisticallyDelete = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: (params) => removeBoardCardData({ trpc, queryClient, params }),
    successToast: 'Card deleted',
    errorToast: 'Failed to delete the card. Please try again.',
    mutation: setStateMutation,
    undoMutationConfig: ({ boardId, boardCardId }) => ({
      mutation: setStateMutation,
      params: { boardId, boardCardId, state: BoardCardState.INBOX },
    }),
  });
  const optimisticallyMarkAsUnread = useOptimisticMutation({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardId, boardCardId }) =>
      setUnreadBoardCardData({ trpc: trpc, queryClient, params: { boardId, boardCardId, unread: true } }),
    errorToast: 'Failed to mark the card as unread. Please try again.',
    mutation: useMutation(trpc.boardCard.markAsUnread.mutationOptions()),
  });

  if (!boardData) return <div className="h-8" />;

  return (
    <div className="flex gap-8 items-center mr-11">
      <Select
        value={boardColumn?.id}
        onValueChange={(value) => optimisticallySetBoardColumn({ boardId, boardCardId, boardColumnId: value })}
      >
        <SelectTrigger size="sm" variant="ghost" className="font-medium text-muted-foreground p-0" hideChevron>
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
        {participantMembers.length > 0 && (
          <AvatarGroup
            className="mr-2"
            avatars={participantMembers.map((member) => (
              <Avatar key={member.user.id} size="xs">
                <AvatarImage src={member.user.photoUrl} alt={member.user.name} />
                <AvatarFallback hashForBgColor={member.user.name}>
                  {member.user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          />
        )}
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
          <TooltipContent side="bottom">
            Mark as unread
            {boardMembers.filter((m) => m.role !== BoardMemberRole.AGENT).length === 1 ? '' : ' (only for you)'}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center ml-auto">
        <Select
          value={assignedMember?.id || 'unassigned'}
          onValueChange={(value) =>
            optimisticallySetAssignee({
              boardId,
              boardCardId,
              boardMemberId: value === 'unassigned' ? null : value,
            })
          }
        >
          <SelectTrigger size="sm" variant="ghost" className="text-sm p-0 gap-1.5" hideChevron>
            {assignedMember ? (
              <div className="flex items-center gap-1.5">
                <Avatar size="xs">
                  <AvatarImage src={assignedMember.user.photoUrl} alt={assignedMember.user.name} />
                  <AvatarFallback hashForBgColor={assignedMember.user.name}>
                    {assignedMember.user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{assignedMember.user.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {boardMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <Avatar size="xs">
                      <AvatarImage src={member.user.photoUrl} alt={member.user.name} />
                      <AvatarFallback hashForBgColor={member.user.name}>
                        {member.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{member.user.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
