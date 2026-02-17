import { useDraggable } from '@dnd-kit/core';
import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Mail, MailCheck, Mails, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useRouteContext } from '@/hooks/use-route-context';
import { type Board, type BoardMember, solo } from '@/query-helpers/board';
import { type BoardCard as BoardCardType, setUnreadBoardCardData } from '@/query-helpers/board-cards';
import { cn } from '@/utils/strings';
import { formattedTimeAgo } from '@/utils/time';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

export const DRAG_TYPE = 'board-card';

export const BoardCardContent = ({
  boardCard,
  boardMembers,
  isHovered,
  onToggleReadStatus,
}: {
  boardCard: BoardCardType;
  boardMembers: BoardMember[];
  isHovered?: boolean;
  onToggleReadStatus?: (e: React.MouseEvent) => void;
}) => {
  const firstParticipant = boardCard.participantsAsc[0];
  const firstParticipantName = firstParticipant.name || firstParticipant.email;
  const { iconUrl } = boardCard.domain;
  const draft = boardCard.emailDraft && !boardCard.emailDraft.generated;
  const { unread } = boardCard;
  const grayscale = !unread && !draft && !isHovered && isHovered !== undefined;

  const soloBoard = solo(boardMembers);
  const participantMembers = boardMembers.filter((m) => boardCard.participantUserIds?.includes(m.user.id)) || [];
  const assignedMember = boardMembers.find((m) => m.id === boardCard.assignedBoardMemberId);

  return (
    <div className={cn('flex flex-col transition-filter duration-200', grayscale ? 'grayscale-100' : '')}>
      <div className="flex items-center mb-1.5">
        <Avatar size="xs" className={cn('transition-filter duration-200', grayscale ? 'opacity-60' : '')}>
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
          {!unread && draft && <div className="bg-semi-muted rounded-full min-w-2 min-h-2 mr-1.5 flex-shrink-0" />}
          <div className="truncate">
            <span className={unread || draft ? 'font-bold' : 'font-medium'}>{firstParticipantName}</span>
            {boardCard.participantsAsc.length > 1 && (
              <span className="text-muted-foreground">
                ,{' '}
                {boardCard.participantsAsc
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
            <TooltipContent>
              {unread ? 'Mark as read' : 'Mark as unread'}
              {soloBoard ? '' : ' (only for you)'}
            </TooltipContent>
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
      <div className={cn('text-xs truncate mb-1', unread || draft ? 'font-medium' : 'text-text-secondary')}>
        {boardCard.subject}
      </div>
      <div className="text-xs text-muted-foreground truncate">{boardCard.snippet}</div>
      <div className="flex items-center gap-3 mt-1 text-2xs text-muted-foreground">
        {(assignedMember || (!soloBoard && participantMembers.length > 0)) && (
          <AvatarGroup
            avatars={[
              assignedMember && (
                <Avatar size="2xs">
                  <AvatarImage
                    src={assignedMember.user.photoUrl}
                    alt={assignedMember.user.fullName}
                    className={cn('transition-filter duration-200', grayscale && 'opacity-75')}
                  />
                  <AvatarFallback
                    hashForBgColor={assignedMember.user.fullName}
                    className={cn('transition-filter duration-200', grayscale && 'opacity-75')}
                  >
                    {assignedMember.user.fullName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ),
              ...(soloBoard
                ? []
                : participantMembers
                    .filter((m) => m.id !== assignedMember?.id)
                    .map((member) => (
                      <Avatar key={member.user.id} size="2xs">
                        <AvatarImage
                          src={member.user.photoUrl}
                          alt={member.user.fullName}
                          className={cn('transition-filter duration-200', grayscale && 'opacity-75')}
                        />
                        <AvatarFallback
                          hashForBgColor={member.user.fullName}
                          className={cn('transition-filter duration-200', grayscale && 'opacity-75')}
                        >
                          {member.user.fullName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))),
            ]}
          />
        )}
        {boardCard.hasAttachments && <Paperclip className="size-3" />}
        {boardCard.emailMessageCount > 1 && (
          <div className="flex items-center gap-1">
            <Mails className="size-3.5" />
            <span>{boardCard.emailMessageCount}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const BoardCard = ({
  board,
  boardCard,
  boardMembers,
}: {
  board: Board;
  boardCard: BoardCardType;
  boardMembers: BoardMember[];
}) => {
  const { queryClient, trpc } = useRouteContext();
  const [isHovered, setIsHovered] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: boardCard.id,
    data: { boardCard, type: DRAG_TYPE },
  });

  const boardCardsQueryKey = trpc.boardCard.getBoardCards.queryKey({ boardId: board.id });
  const optimisticallyMarkAsRead = useOptimisticMutation({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardId, boardCardId }) =>
      setUnreadBoardCardData({ trpc, queryClient, params: { boardId, boardCardId, unread: false } }),
    errorToast: 'Failed to mark the card as read. Please try again.',
    mutation: useMutation(trpc.boardCard.markAsRead.mutationOptions()),
  });
  const optimisticallyMarkAsUnread = useOptimisticMutation({
    queryClient,
    queryKey: boardCardsQueryKey,
    onExecute: ({ boardId, boardCardId }) =>
      setUnreadBoardCardData({ trpc, queryClient, params: { boardId, boardCardId, unread: true } }),
    errorToast: 'Failed to mark the card as unread. Please try again.',
    mutation: useMutation(trpc.boardCard.markAsUnread.mutationOptions()),
  });

  const handleToggleReadStatus = (e: React.MouseEvent) => {
    e.preventDefault();
    if (boardCard.unread) {
      optimisticallyMarkAsRead({ boardId: board.id, boardCardId: boardCard.id });
    } else {
      optimisticallyMarkAsUnread({ boardId: board.id, boardCardId: boardCard.id });
    }
    setIsHovered(false);
  };

  return (
    <Link to={ROUTES.BOARD_CARD.replace('$boardId', board.friendlyId).replace('$boardCardId', boardCard.id)}>
      <Card
        ref={setNodeRef}
        style={isDragging ? { opacity: 0 } : undefined}
        {...attributes}
        {...listeners}
        className={`p-3 transition-shadow rounded-lg shadow-xs cursor-pointer ${isHovered ? 'border-semi-muted' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <BoardCardContent
          boardCard={boardCard}
          boardMembers={boardMembers}
          isHovered={isHovered}
          onToggleReadStatus={handleToggleReadStatus}
        />
      </Card>
    </Link>
  );
};

export const BoardCardDragged = ({ children }: { children: React.ReactNode }) => {
  return (
    <Card className="cursor-grabbing p-3 rounded-lg shadow-lg w-64" style={{ transform: 'rotate(5deg)' }}>
      {children}
    </Card>
  );
};

export const BoardCardParentDragged = ({ children }: { children: React.ReactNode }) => {
  return <Card className="p-3 rounded-lg">{children}</Card>;
};
