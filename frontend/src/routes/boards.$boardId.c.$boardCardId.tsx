import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, useMatches, useNavigate } from '@tanstack/react-router';
import { FALLBACK_SUBJECT } from 'bordly-backend/utils/shared';
import { useEffect, useState } from 'react';
import { BoardCardDialogNavbar } from '@/components/board-card/board-card-dialog-navbar';
import { CommentInput } from '@/components/board-card/comment-input';
import { EmailDraftCard } from '@/components/board-card/email-draft-card';
import { TimelineMessages } from '@/components/board-card/timeline-messages';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { usePrefetchQuery } from '@/hooks/use-prefetch-query';
import { RouteProvider } from '@/hooks/use-route-context';
import { useScrollContainer } from '@/hooks/use-scroll-container';
import { ensureLoggedIn } from '@/loaders/authentication';
import { setBoardCardSubjectData } from '@/query-helpers/board-card';
import {
  replaceBoardCardData,
  setBoardCardSubjectData as setBoardCardSubjectDataInList,
} from '@/query-helpers/board-cards';
import { cn, extractUuid } from '@/utils/strings';
import { ROUTES } from '@/utils/urls';

const SCROLL_DELAY_MS = 100;

export const Route = createFileRoute('/boards/$boardId/c/$boardCardId')({
  component: BoardCardComponent,
  loader: async ({ context: { queryClient, trpc }, params }) => {
    const data = await ensureLoggedIn(ROUTES.BOARD_CARD)({ context: { queryClient, trpc } });

    const boardId = extractUuid(params.boardId);
    const boardCardId = extractUuid(params.boardCardId);
    queryClient.ensureQueryData(trpc.boardCard.get.queryOptions({ boardId, boardCardId }));

    return data;
  },
});

function BoardCardComponent() {
  const { currentUser } = Route.useLoaderData();
  const matches = useMatches();
  const params = Route.useParams();
  const navigate = useNavigate();
  const context = Route.useRouteContext();
  const { trpc, queryClient } = context;

  const boardId = extractUuid(params.boardId);
  const boardCardId = extractUuid(params.boardCardId);

  const [subject, setSubject] = useState('');
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [draftChangeCount, setDraftChangeCount] = useState(0);
  const [shouldMaintainScrollBottom, setShouldMaintainScrollBottom] = useState(false);
  const { isScrolled, scrollContainerRef, scrollContainerElement, bottomRef, scrollToBottom } = useScrollContainer();

  const {
    data: boardCardData,
    isLoading,
    error,
  } = useQuery({ ...trpc.boardCard.get.queryOptions({ boardId, boardCardId }), retry: false });
  if (error && error.data?.code === 'NOT_FOUND') {
    navigate({ to: ROUTES.BOARD.replace('$boardId', params.boardId) });
  }

  const { data: boardData } = useQuery(trpc.board.get.queryOptions({ boardId }));

  const boardCard = boardCardData?.boardCard;
  const emailMessagesAsc = boardCardData?.emailMessagesAsc;
  const commentsAsc = boardCardData?.commentsAsc || [];
  const boardMembers = boardData?.boardMembers || [];
  const boardColumn = boardData?.boardColumnsAsc.find((col) => col.id === boardCard?.boardColumnId);

  const markAsReadMutation = useMutation(
    trpc.boardCard.markAsRead.mutationOptions({
      onSuccess: ({ boardCard }) => replaceBoardCardData({ queryClient, trpc, params: { boardId, boardCard } }),
    }),
  );

  const optimisticallySetSubject = useOptimisticMutation({
    queryClient,
    queryKey: trpc.boardCard.get.queryKey({ boardId, boardCardId }),
    onExecute: (params) => {
      setBoardCardSubjectData({ trpc, queryClient, params });
      setBoardCardSubjectDataInList({ trpc, queryClient, params });
    },
    errorToast: 'Failed to update subject. Please try again.',
    mutation: useMutation(trpc.boardCard.setSubject.mutationOptions()),
  });
  const handleSubjectChange = () => {
    setIsEditingSubject(false);
    if (subject !== boardCard?.subject) {
      const newSubject = subject || FALLBACK_SUBJECT;
      setSubject(newSubject);
      optimisticallySetSubject({ boardId, boardCardId, subject: newSubject });
    }
  };

  // Mark as read on open if there are unread messages and set document title to email subject, scroll to bottom if already read
  // biome-ignore lint/correctness/useExhaustiveDependencies: ignore markAsReadMutation to avoid infinite loop
  useEffect(() => {
    if (boardCard) {
      document.title = `${boardCard.subject} | Bordly`;
      setSubject(boardCard.subject === FALLBACK_SUBJECT ? '' : boardCard.subject);

      if (boardCard.unread) {
        markAsReadMutation.mutate({ boardId, boardCardId });
      } else {
        setShouldMaintainScrollBottom(true);
      }
    }

    if (boardCard?.emailDraft && !boardCard.emailDraft.generated) {
      setShowReply(true);
    }
  }, [boardCard, boardId, boardCardId, matches.length]);

  // Scroll to bottom when reply card is shown
  useEffect(() => {
    if (showReply) {
      setTimeout(() => scrollToBottom(), SCROLL_DELAY_MS);
    }
  }, [showReply, scrollToBottom]);

  // Maintain scroll at bottom when content changes for already-read cards
  useEffect(() => {
    if (!shouldMaintainScrollBottom) return;
    const container = scrollContainerElement.current;
    if (!container || !bottomRef.current) return;
    // Scroll to bottom immediately
    bottomRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
    // Use MutationObserver to detect content changes and maintain scroll position
    const observer = new MutationObserver(() => {
      if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'instant', block: 'end' });
    });
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    // Stop maintaining scroll
    const timeout = setTimeout(() => setShouldMaintainScrollBottom(false), SCROLL_DELAY_MS);
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [shouldMaintainScrollBottom, scrollContainerElement, bottomRef]);

  // Prefetch email addresses for EmailDraftCard
  usePrefetchQuery(queryClient, {
    ...trpc.senderEmailAddress.getAddressesForBoardMember.queryOptions({
      boardId,
      boardAccountId: boardCard?.boardAccountId || '',
    }),
    enabled: !!boardCard?.boardAccountId,
  });

  // Reload draft if changed by another user to keep it up to date
  useEffect(() => {
    if (boardCard?.emailDraft?.lastEditedByUserId !== currentUser.id && boardCard?.emailDraft?.updatedAt) {
      setDraftChangeCount((count) => count + 1);
    }
  }, [boardCard?.emailDraft?.lastEditedByUserId, boardCard?.emailDraft?.updatedAt, currentUser.id]);

  const noMessages = boardCard?.emailMessageCount === 0;

  return (
    <RouteProvider value={{ trpc, queryClient, currentUser }}>
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
          {!isLoading && boardCard && boardColumn && emailMessagesAsc && boardData && (
            <>
              <DialogHeader className={cn('px-5 pt-2 pb-1.5 transition-shadow', isScrolled && 'shadow-sm')}>
                <BoardCardDialogNavbar
                  boardId={boardId}
                  boardCard={boardCard}
                  boardColumnsAsc={boardData.boardColumnsAsc}
                  boardMembers={boardMembers}
                />
              </DialogHeader>
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 mb-10">
                <div className={isEditingSubject ? 'mt-1 mb-2' : 'mb-3 mt-2'}>
                  {isEditingSubject && noMessages ? (
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      onBlur={handleSubjectChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSubjectChange();
                        } else if (e.key === 'Escape') {
                          setSubject(boardCard.subject);
                          setIsEditingSubject(false);
                        }
                      }}
                      variant="ghost"
                      className="text-base font-semibold h-5"
                      autoFocus
                    />
                  ) : (
                    <DialogTitle
                      className={noMessages ? 'cursor-pointer hover:text-primary' : ''}
                      onClick={noMessages ? () => setIsEditingSubject(true) : undefined}
                    >
                      {noMessages && boardCard.subject === FALLBACK_SUBJECT ? (
                        <span className="text-semi-muted">Subject</span>
                      ) : (
                        subject
                      )}
                    </DialogTitle>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <TimelineMessages
                    emailMessages={emailMessagesAsc}
                    comments={commentsAsc}
                    boardId={boardId}
                    boardCardId={boardCardId}
                    boardMembers={boardMembers}
                    onReply={() => setShowReply(true)}
                  />
                  {showReply && (
                    <EmailDraftCard
                      key={draftChangeCount}
                      boardId={boardId}
                      boardCard={boardCard}
                      emailDraft={boardCard.emailDraft}
                      emailMessagesAsc={emailMessagesAsc}
                      onDiscard={() => setShowReply(false)}
                    />
                  )}
                  <div ref={bottomRef} className="mt-4" />
                </div>
              </div>
              <CommentInput
                boardId={boardId}
                boardCardId={boardCardId}
                context={context}
                boardMembers={boardMembers}
                onCommentAdded={() => {
                  setTimeout(() => scrollToBottom(), SCROLL_DELAY_MS);
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </RouteProvider>
  );
}
