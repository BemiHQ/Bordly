import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { BoardCardDialogNavbar } from '@/components/board-card/board-card-dialog-navbar';
import { EmailMessageCard } from '@/components/board-card/email-message-card';
import { ReplyCard } from '@/components/board-card/reply-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { RouteProvider } from '@/hooks/use-route-context';
import { cn, extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/boards/$boardId/c/$boardCardId')({
  component: BoardCardComponent,
  beforeLoad: async ({ context: { queryClient, trpc } }) => {
    const { currentUser, boards } = await queryClient.ensureQueryData(trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (boards.length === 0) {
      throw redirect({ to: ROUTES.WELCOME });
    }
  },
});

function BoardCardComponent() {
  const context = Route.useRouteContext();
  const params = Route.useParams();
  const navigate = useNavigate();

  const boardId = extractUuid(params.boardId);
  const boardCardId = extractUuid(params.boardCardId);

  const [showReply, setShowReply] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setScrollContainer(node);
  }, []);

  const {
    data: emailMessagesData,
    isLoading,
    error,
  } = useQuery({ ...context.trpc.emailMessage.getEmailMessages.queryOptions({ boardId, boardCardId }), retry: false });
  if (error && error.data?.code === 'NOT_FOUND') {
    navigate({ to: ROUTES.BOARD.replace('$boardId', params.boardId) });
  }

  const boardCard = emailMessagesData?.boardCard;
  const boardColumn = emailMessagesData?.boardColumn;
  const emailMessagesAsc = emailMessagesData?.emailMessagesAsc;

  const markAsReadMutation = useMutation(
    context.trpc.boardCard.markAsRead.mutationOptions({
      onSuccess: ({ boardCard }) => {
        context.queryClient.setQueryData(context.trpc.boardCard.getBoardCards.queryKey({ boardId }), (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            boardCardsDesc: oldData.boardCardsDesc.map((card) => (card.id === boardCard.id ? boardCard : card)),
          } satisfies typeof oldData;
        });
      },
    }),
  );

  // Mark as read on open if there are unread messages and set document title to email subject
  // biome-ignore lint/correctness/useExhaustiveDependencies: ignore markAsReadMutation to avoid infinite loop
  useEffect(() => {
    if (boardCard?.unreadEmailMessageIds?.length) {
      markAsReadMutation.mutate({ boardId, boardCardId });
    }

    if (boardCard) {
      document.title = `${boardCard.subject} | Bordly`;
    }

    if (boardCard?.emailDraft && !boardCard.emailDraft.generated) {
      setShowReply(true);
    }
  }, [boardCard, boardId, boardCardId]);

  // Track scroll position for DialogHeader shadow
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollTop > 0);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollContainer]);

  // Scroll to bottom when reply card is shown
  useEffect(() => {
    if (showReply && scrollContainer) {
      setTimeout(() => {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [showReply, scrollContainer]);

  return (
    <RouteProvider value={context}>
      <Dialog
        open={true}
        onOpenChange={(open: boolean) => {
          if (!open) navigate({ to: ROUTES.BOARD.replace('$boardId', params.boardId) });
        }}
      >
        <DialogContent
          className="min-w-5xl gap-2 h-[90vh] flex flex-col bg-secondary p-0 gap-0"
          aria-describedby={undefined}
          closeClassName="hover:bg-border top-2 right-4"
        >
          <DialogTitle visuallyHidden>{boardCard?.subject}</DialogTitle>
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          )}
          {!isLoading && boardCard && boardColumn && emailMessagesAsc && (
            <>
              <DialogHeader className={cn('px-6 pt-2 pb-1.5 transition-shadow', isScrolled && 'shadow-sm')}>
                <BoardCardDialogNavbar
                  context={context}
                  boardId={boardId}
                  boardCardId={boardCardId}
                  boardColumn={boardColumn}
                />
              </DialogHeader>
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-thin px-6 pb-6">
                <DialogTitle className="mb-3 mt-2">{boardCard?.subject}</DialogTitle>
                <div className="flex flex-col gap-4">
                  {emailMessagesAsc.map((emailMessage, index) => (
                    <EmailMessageCard
                      key={emailMessage.id}
                      emailMessage={emailMessage}
                      boardId={boardId}
                      boardCardId={boardCardId}
                      onReply={index === emailMessagesAsc.length - 1 ? () => setShowReply(true) : undefined}
                    />
                  ))}
                  {showReply && (
                    <ReplyCard
                      boardId={boardId}
                      boardCardId={boardCardId}
                      emailDraft={boardCard.emailDraft}
                      emailMessagesAsc={emailMessagesAsc}
                      onDiscard={() => setShowReply(false)}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </RouteProvider>
  );
}
