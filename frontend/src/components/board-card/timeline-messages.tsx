import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { EmailMessageCard } from '@/components/board-card/email-message-card';
import { PostedComment } from '@/components/board-card/posted-comment';

type EmailMessage = inferRouterOutputs<TRPCRouter>['boardCard']['get']['emailMessagesAsc'][number];
type Comment = inferRouterOutputs<TRPCRouter>['boardCard']['get']['commentsAsc'][number];

type TimelineItem =
  | { type: 'email'; data: EmailMessage; timestamp: Date }
  | { type: 'comment'; data: Comment; timestamp: Date };

export const TimelineMessages = ({
  emailMessages,
  comments,
  boardId,
  boardCardId,
  onReply,
}: {
  emailMessages: EmailMessage[];
  comments: Comment[];
  boardId: string;
  boardCardId: string;
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
              onReply={index === lastEmailIndex ? onReply : undefined}
            />
          );
        }
        return <PostedComment key={item.data.id} comment={item.data} />;
      })}
    </>
  );
};
