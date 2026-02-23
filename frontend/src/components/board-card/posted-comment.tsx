import { useMutation } from '@tanstack/react-query';
import { isBordlyComment } from 'bordly-backend/utils/shared';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useOptimisticMutationWithUndo } from '@/hooks/use-optimistic-mutation-with-undo';
import { useRouteContext } from '@/hooks/use-route-context';
import { type BoardMember, solo } from '@/query-helpers/board';
import type { Comment } from '@/query-helpers/board-card';
import {
  addBordlyThinkingComment,
  deleteBordlyThinkingComment,
  deleteCommentData,
  replaceBoardCardData,
  updateCommentData,
} from '@/query-helpers/board-card';
import { replaceBoardCardData as replaceBoardCardDataInList } from '@/query-helpers/board-cards';
import { cn } from '@/utils/strings';
import { formattedShortTime } from '@/utils/time';

export const PostedComment = ({
  comment,
  boardId,
  boardCardId,
  boardMembers,
}: {
  comment: Comment;
  boardId: string;
  boardCardId: string;
  boardMembers: BoardMember[];
}) => {
  const { trpc, queryClient, currentUser } = useRouteContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const boardCardQueryKey = trpc.boardCard.get.queryKey({ boardId, boardCardId });
  const optimisticallyEditComment = useOptimisticMutation({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: (params) => {
      updateCommentData({ trpc, queryClient, params });
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
    errorToast: 'Failed to edit comment',
    mutation: useMutation(
      trpc.comment.edit.mutationOptions({
        onSuccess: ({ boardCard }) => {
          replaceBoardCardData({ trpc, queryClient, params: { boardId, boardCard } });
          deleteBordlyThinkingComment({ trpc, queryClient, params: { boardId, boardCardId } });

          replaceBoardCardDataInList({ trpc, queryClient, params: { boardId, boardCard } });
        },
      }),
    ),
  });

  const createCommentMutation = useMutation(trpc.comment.create.mutationOptions());
  const optimisticallyDeleteComment = useOptimisticMutationWithUndo({
    queryClient,
    queryKey: boardCardQueryKey,
    onExecute: (params) => deleteCommentData({ trpc, queryClient, params }),
    successToast: 'Comment deleted',
    errorToast: 'Failed to delete the comment',
    mutation: useMutation(
      trpc.comment.delete.mutationOptions({
        onSuccess: ({ boardCard }) => {
          replaceBoardCardData({ trpc, queryClient, params: { boardId, boardCard } });
          replaceBoardCardDataInList({ trpc, queryClient, params: { boardId, boardCard } });
        },
      }),
    ),
    undoMutationConfig: () => ({
      mutation: createCommentMutation,
      params: { boardId, boardCardId, text: comment.text },
    }),
  });

  const handleEdit = () => {
    if (!editText.trim() || editText === comment.text) {
      setIsEditing(false);
      setEditText(comment.text);
      return;
    }
    optimisticallyEditComment({ boardId, boardCardId, commentId: comment.id, text: editText.trim() });
    setIsEditing(false);
  };

  const handleDelete = () => {
    optimisticallyDeleteComment({ boardId, boardCardId, commentId: comment.id });
  };

  const isOwnComment = currentUser?.id === comment.user.id;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 ml-8.5">
        <div className="text-xs font-medium">{comment.user.fullName}</div>
        <div className="text-3xs text-muted-foreground">
          {formattedShortTime(new Date(comment.createdAt))}
          {comment.editedAt && ' (edited)'}
        </div>
      </div>
      <div className="flex flex-start gap-2 relative">
        <Avatar size="sm">
          <AvatarImage src={comment.user.photoUrl} alt={comment.user.fullName} />
        </Avatar>
        {isEditing ? (
          <div className="flex-1">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsEditing(false);
                  setEditText(comment.text);
                }
              }}
              placeholder={`Chat with @Bordly${solo(boardMembers) ? '' : ' and your team'}...`}
              className="text-sm bg-primary-foreground font-sans py-1.5"
              rows={1}
              autoResize
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <Button onClick={handleEdit} size="sm">
                Save
              </Button>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setEditText(comment.text);
                }}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-row gap-1 group">
            <div className="text-sm text-text-secondary font-normal bg-border rounded-md px-2.5 py-[3px] whitespace-pre-wrap">
              {comment.text}
            </div>
            {isOwnComment && (
              <DropdownMenu onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      'group-hover:opacity-100 transition-opacity',
                      dropdownOpen ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    <Ellipsis className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} variant="destructive">
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
