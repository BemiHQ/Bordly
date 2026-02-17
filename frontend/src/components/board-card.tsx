import { useDraggable } from '@dnd-kit/core';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { Mail, MailCheck, Mails, Paperclip, Send } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useRouteContext } from '@/hooks/use-route-context';
import { cn } from '@/utils/strings';
import { formattedTimeAgo } from '@/utils/time';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
type Board = BoardData['board'];

type BoardCardsData = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
type BoardCardType = BoardCardsData['boardCards'][number];

export const BoardCardContent = ({
  boardCard,
  unread,
  isHovered,
  onToggleReadStatus,
}: {
  boardCard: BoardCardType;
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

export const BoardCard = ({ board, boardCard }: { board: Board; boardCard: BoardCardType }) => {
  const { queryClient, trpc } = useRouteContext();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const unread = !!boardCard.unreadEmailMessageIds;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: boardCard.id,
    data: { boardCard },
  });

  const boardCardsQueryKey = trpc.boardCard.getBoardCards.queryKey({ boardId: board.id });

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
    onSuccess: ({ boardCard }: { boardCard: BoardCardType }) => {
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
    },
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
