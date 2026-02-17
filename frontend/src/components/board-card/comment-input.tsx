import { useMutation } from '@tanstack/react-query';
import { ArrowDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import type { RouteContext } from '@/hooks/use-route-context';

export const CommentInput = ({
  boardId,
  boardCardId,
  context,
  onCommentAdded,
}: {
  boardId: string;
  boardCardId: string;
  context: RouteContext;
  onCommentAdded?: () => void;
}) => {
  const { trpc, queryClient } = context;
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createCommentMutation = useMutation(trpc.comment.create.mutationOptions());

  const boardCardQueryKey = trpc.boardCard.get.queryKey({ boardId, boardCardId });
  const optimisticallyCreateComment = useOptimisticMutation({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: () => {
      const currentUserData = queryClient.getQueryData(trpc.user.getCurrentUser.queryKey());
      const currentUser = currentUserData?.currentUser;
      queryClient.setQueryData(boardCardQueryKey, (oldData) => {
        if (!oldData || !currentUser) return oldData;
        const newComment = {
          id: crypto.randomUUID(),
          boardCardId,
          user: currentUser,
          text,
          createdAt: new Date(),
          editedAt: undefined,
        };
        return { ...oldData, commentsAsc: [...oldData.commentsAsc, newComment] } satisfies typeof oldData;
      });
    },
    onSuccess: ({ comment, boardCard }) => {
      queryClient.setQueryData(boardCardQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          commentsAsc: oldData.commentsAsc.map((c) => (c.id === comment.id ? comment : c)),
          boardCard,
        } satisfies typeof oldData;
      });
      queryClient.setQueryData(trpc.boardCard.getBoardCards.queryKey({ boardId }), (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCard.id ? boardCard : c)),
        } satisfies typeof oldData;
      });
    },
    successToast: undefined,
    errorToast: 'Failed to add comment',
    mutation: createCommentMutation,
  });

  const handleSubmit = () => {
    if (!text.trim()) return;

    optimisticallyCreateComment({ boardId, boardCardId, text: text.trim() });
    setText('');
    onCommentAdded?.();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: text is needed to resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, [text]);

  return (
    <div className="static bottom-0 px-5 pb-5">
      <div className="flex">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Chat with @Bordly and your team..."
          className="resize-none bg-primary-foreground pr-10"
          rows={1}
        />
        {text.trim() && (
          <div className="fixed right-6 bottom-5.5 z-10">
            <Button onClick={handleSubmit} size="icon" className="size-5.5 rounded-full">
              <ArrowDown className="size-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
