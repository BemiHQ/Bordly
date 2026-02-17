import { EmailMessageCard } from '@/components/board-card/email-message-card';
import { PostedComment } from '@/components/board-card/posted-comment';
import type { BoardMember } from '@/query-helpers/board';
import type { Comment, EmailMessage } from '@/query-helpers/board-card';

type TimelineItem =
  | { type: 'email'; data: EmailMessage; timestamp: Date }
  | { type: 'comment'; data: Comment; timestamp: Date };

export const TimelineMessages = ({
  emailMessages,
  comments,
  boardId,
  boardCardId,
  boardMembers,
  onReply,
}: {
  emailMessages: EmailMessage[];
  comments: Comment[];
  boardId: string;
  boardCardId: string;
  boardMembers: BoardMember[];
  onReply?: () => void;
}) => {
  const timelineItems: TimelineItem[] = [
    ...emailMessages.map((emailMessage) => ({
      type: 'email' as const,
      data: emailMessage,
      timestamp: new Date(emailMessage.externalCreatedAt),
    })),
    ...comments.map((comment) => ({
      type: 'comment' as const,
      data: comment,
      timestamp: new Date(comment.createdAt),
    })),
  ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const lastEmailIndex = timelineItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type === 'email')
    .pop()?.index;

  return (
    <>
      {timelineItems.map((item, index) => {
        if (item.type === 'email') {
          return (
            <EmailMessageCard
              key={item.data.id}
              emailMessage={item.data}
              boardId={boardId}
              boardCardId={boardCardId}
              boardMembers={boardMembers}
              onReply={index === lastEmailIndex ? onReply : undefined}
            />
          );
        }
        return <PostedComment key={item.data.id} comment={item.data} boardId={boardId} boardCardId={boardCardId} />;
      })}
    </>
  );
};
