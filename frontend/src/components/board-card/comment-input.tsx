import { useMutation } from '@tanstack/react-query';
import { isBordlyComment } from 'bordly-backend/utils/shared';
import { ArrowDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import type { RouteContext } from '@/hooks/use-route-context';
import { type BoardMember, solo } from '@/query-helpers/board';
import {
  addBordlyThinkingComment,
  addFakeCommentData,
  removeBordlyThinkingComment,
  replaceBoardCardData,
  replaceFakeCommentData,
} from '@/query-helpers/board-card';
import { replaceBoardCardData as replaceBoardCardDataInList } from '@/query-helpers/board-cards';
import { cn } from '@/utils/strings';

export const CommentInput = ({
  boardId,
  boardCardId,
  context,
  boardMembers,
  onCommentAdded,
}: {
  boardId: string;
  boardCardId: string;
  context: RouteContext;
  boardMembers: BoardMember[];
  onCommentAdded?: () => void;
}) => {
  const { trpc, queryClient } = context;
  const [text, setText] = useState('');

  const boardCardQueryKey = trpc.boardCard.get.queryKey({ boardId, boardCardId });
  const optimisticallyCreateComment = useOptimisticMutation({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: (params) => {
      addFakeCommentData({ trpc, queryClient, params });
      if (isBordlyComment(params.text)) {
        const bordlyUser = boardMembers.find((member) => member.isAgent);
        if (bordlyUser) {
          addBordlyThinkingComment({
            trpc,
            queryClient,
            params: { boardId, boardCardId, bordlyUser: bordlyUser.user },
          });
        }
      }
    },
    successToast: undefined,
    errorToast: 'Failed to add comment',
    mutation: useMutation(
      trpc.comment.create.mutationOptions({
        onSuccess: ({ comment, boardCard }) => {
          replaceFakeCommentData({ trpc, queryClient, params: { boardId, boardCardId, comment } });
          replaceBoardCardData({ trpc, queryClient, params: { boardId, boardCard } });
          removeBordlyThinkingComment({ trpc, queryClient, params: { boardId, boardCardId } });

          replaceBoardCardDataInList({ trpc, queryClient, params: { boardId, boardCard } });
        },
      }),
    ),
  });

  const handleSubmit = () => {
    if (!text.trim()) return;

    optimisticallyCreateComment({ boardId, boardCardId, text: text.trim() });
    setText('');
    onCommentAdded?.();
  };

  return (
    <div className="fixed bottom-0 w-full rounded-b-lg">
      <div className="relative z-10 mx-[19px] mb-5 rounded-lg bg-primary-foreground">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={`Chat with @Bordly${solo(boardMembers) ? '' : ' and your team'}...`}
          className={cn(
            'bg-transparent pr-10 font-sans py-1.5',
            text.trim() && 'border-semi-muted focus-visible:border-semi-muted focus-visible:ring-0 ',
          )}
          rows={1}
          autoResize
        />
        {text.trim() && (
          <div className="fixed right-7 bottom-[25px] z-10">
            <Button onClick={handleSubmit} size="icon" className="size-5.5 rounded-full">
              <ArrowDown className="size-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="fixed bottom-0 h-10 w-[calc(100%-24px)] mx-3 bg-secondary" />
    </div>
  );
};
