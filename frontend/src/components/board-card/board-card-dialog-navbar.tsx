import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BoardCardState } from 'bordly-backend/utils/shared';
import { Archive, Mail, OctagonX, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { useRouteContext } from '@/hooks/use-route-context';
import { type BoardColumn as BoardColumnType, type BoardMember, solo } from '@/query-helpers/board';
import { type BoardCard, replaceBoardColumnIdData, setAssignedBoardMemberData } from '@/query-helpers/board-card';
import {
  changeBoardCardColumnData,
  removeBoardCardData,
  setBoardCardAssignedBoardMemberData,
  setUnreadBoardCardData,
} from '@/query-helpers/board-cards';
import { ROUTES } from '@/utils/urls';

export const BoardCardDialogNavbar = ({
  boardId,
  boardCard,
  boardColumnsAsc,
  boardMembers,
}: {
  boardId: string;
  boardCard?: BoardCard;
  boardColumnsAsc: BoardColumnType[];
  boardMembers: BoardMember[];
}) => {
  const { trpc, queryClient, currentUser } = useRouteContext();
  const navigate = useNavigate();

  const boardCardId = boardCard?.id;

  const soloBoard = solo(boardMembers);
  const participantMembers = boardCard
    ? boardMembers.filter((m) => boardCard.participantUserIds?.includes(m.user.id))
    : [];
  const assignedMember = boardCard ? boardMembers.find((m) => m.id === boardCard.assignedBoardMemberId) : undefined;
  const currentUserMember = boardMembers.find((m) => m.user.id === currentUser!.id)!;

  const boardCardQueryKey = trpc.boardCard.get.queryKey({ boardId, boardCardId });
  const optimisticallySetAssignee = useOptimisticMutation({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: (params) => {
      setAssignedBoardMemberData({ trpc, queryClient, params });
      setBoardCardAssignedBoardMemberData({ trpc, queryClient, params });
    },
    errorToast: 'Failed to update assignee. Please try again.',
    mutation: useMutation(trpc.boardCard.setAssignee.mutationOptions()),
  });
  const optimisticallySetBoardColumn = useOptimisticMutation({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: (params) => {
      const boardColumn = boardColumnsAsc.find((col) => col.id === params.boardColumnId)!;
      replaceBoardColumnIdData({
        trpc: trpc,
        queryClient,
        params: { ...params, boardColumnId: boardColumn.id },
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

  const boardColumn = boardCard ? boardColumnsAsc.find((col) => col.id === boardCard.boardColumnId) : undefined;

  return (
    <div className="flex gap-8 items-center mr-11">
      <Select
        value={boardColumn?.id}
        onValueChange={(value) =>
          boardCard && optimisticallySetBoardColumn({ boardId, boardCardId: boardCard.id, boardColumnId: value })
        }
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
      {boardCard && boardCard.emailMessageCount > 0 && (
        <div className="flex items-center gap-2">
          {!soloBoard &&
            (participantMembers.length > 1 ||
              (participantMembers.length === 1 && participantMembers[0].id !== assignedMember?.id)) && (
              <AvatarGroup
                className="mr-2"
                avatars={participantMembers.map((member) => (
                  <Avatar key={member.user.id} size="xs">
                    <AvatarImage src={member.user.photoUrl} alt={member.user.fullName} />
                    <AvatarFallback hashForBgColor={member.user.fullName}>
                      {member.user.fullName.charAt(0).toUpperCase()}
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
                  if (boardCardId) {
                    optimisticallyArchive({ boardId, boardCardId, state: BoardCardState.ARCHIVED });
                    navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
                  }
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
                  if (boardCardId) {
                    optimisticallyMarkAsSpam({ boardId, boardCardId, state: BoardCardState.SPAM });
                    navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
                  }
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
                  if (boardCardId) {
                    optimisticallyDelete({ boardId, boardCardId, state: BoardCardState.TRASH });
                    navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
                  }
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
                  if (boardCardId) {
                    optimisticallyMarkAsUnread({ boardId, boardCardId });
                    navigate({ to: ROUTES.BOARD.replace('$boardId', boardId) });
                  }
                }}
                className="flex text-muted-foreground cursor-pointer hover:bg-border"
              >
                <Mail className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Mark as unread
              {soloBoard ? '' : ' (only for you)'}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <div className="flex items-center ml-auto">
        <Select
          value={assignedMember?.id || 'unassigned'}
          onValueChange={(value) =>
            boardCard &&
            optimisticallySetAssignee({
              boardId,
              boardCardId: boardCard.id,
              assignedBoardMemberId: value === 'unassigned' ? null : value,
            })
          }
        >
          <SelectTrigger
            size="sm"
            variant="ghost"
            className="font-medium text-muted-foreground p-0 gap-1.5"
            hideChevron
          >
            {assignedMember ? (
              <div className="flex items-center gap-1.5">
                <Avatar size="xs">
                  <AvatarImage src={assignedMember.user.photoUrl} alt={assignedMember.user.fullName} />
                  <AvatarFallback hashForBgColor={assignedMember.user.fullName}>
                    {assignedMember.user.fullName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{assignedMember.user.fullName}</span>
              </div>
            ) : (
              <span>Unassigned</span>
            )}
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectGroup>
              {assignedMember ? (
                <>
                  <SelectItem value={assignedMember.id}>
                    <div className="flex items-center gap-2">
                      <Avatar size="xs">
                        <AvatarImage src={assignedMember.user.photoUrl} alt={assignedMember.user.fullName} />
                        <AvatarFallback hashForBgColor={assignedMember.user.fullName}>
                          {assignedMember.user.fullName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{assignedMember.user.fullName}</span>
                    </div>
                  </SelectItem>
                  <SelectSeparator />
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectSeparator />
                  <SelectItem value={currentUserMember.id}>
                    <div className="flex items-center gap-2">
                      <Avatar size="xs">
                        <AvatarImage src={currentUserMember.user.photoUrl} alt={currentUserMember.user.fullName} />
                        <AvatarFallback hashForBgColor={currentUserMember.user.fullName}>
                          {currentUserMember.user.fullName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{currentUserMember.user.fullName}</span>
                    </div>
                  </SelectItem>
                </>
              )}
              {boardMembers
                .filter((m) => m.id !== assignedMember?.id && m.id !== currentUserMember.id && !m.isAgent)
                .map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar size="xs">
                        <AvatarImage src={member.user.photoUrl} alt={member.user.fullName} />
                        <AvatarFallback hashForBgColor={member.user.fullName}>
                          {member.user.fullName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.user.fullName}</span>
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
