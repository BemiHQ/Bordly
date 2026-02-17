import { Avatar, AvatarImage } from '@/components/ui/avatar';
import type { Comment } from '@/query-helpers/board-card';
import { formattedShortTime } from '@/utils/time';

export const PostedComment = ({ comment }: { comment: Comment }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 ml-8.5">
        <div className="text-xs font-medium">{comment.user.name}</div>
        <div className="text-3xs text-muted-foreground">
          {formattedShortTime(new Date(comment.createdAt))}
          {comment.editedAt && ' (edited)'}
        </div>
      </div>
      <div className="flex flex-start gap-2">
        <Avatar size="sm">
          <AvatarImage src={comment.user.photoUrl} alt={comment.user.name} />
        </Avatar>
        <div className="text-sm text-text-secondary font-normal bg-border rounded-md px-2.5 py-[3px] whitespace-pre-wrap">
          {comment.text}
        </div>
      </div>
    </div>
  );
};
