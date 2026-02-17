import type { QueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import type { TrpcProxy } from '@/trpc';

export type BoardCardData = inferRouterOutputs<TRPCRouter>['boardCard']['get'];

export type BoardCard = BoardCardData['boardCard'];
export type BoardColumn = BoardCardData['boardColumn'];
export type EmailMessage = BoardCardData['emailMessagesAsc'][number];
export type Comment = BoardCardData['commentsAsc'][number];

export type EmailDraft = BoardCard['emailDraft'];
export type Participant = NonNullable<EmailDraft>['from'];
export type FileAttachment = NonNullable<EmailDraft>['fileAttachments'][number];

export type GmailAttachment = EmailMessage['gmailAttachments'][number];

const queryKey = (trpc: TrpcProxy, params: { boardId: string; boardCardId: string }) => {
  return trpc.boardCard.get.queryKey(params);
};

export const removeEmailDraftData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return { ...oldData, boardCard: { ...oldData.boardCard, emailDraft: undefined } } satisfies typeof oldData;
  });
};

export const replaceBoardColumnData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, boardColumn },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; boardColumn: BoardColumn };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return { ...oldData, boardColumn } satisfies typeof oldData;
  });
};

export const addFileAttachmentToEmailDraftData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, fileAttachment },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; fileAttachment: FileAttachment };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData || !oldData.boardCard.emailDraft) return oldData;
    return {
      ...oldData,
      boardCard: {
        ...oldData.boardCard,
        emailDraft: {
          ...oldData.boardCard.emailDraft,
          fileAttachments: [...oldData.boardCard.emailDraft.fileAttachments, fileAttachment],
        },
      },
    } satisfies typeof oldData;
  });
};

export const removeFileAttachmentFromEmailDraftData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, fileAttachmentId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; fileAttachmentId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData || !oldData.boardCard.emailDraft) return oldData;
    return {
      ...oldData,
      boardCard: {
        ...oldData.boardCard,
        emailDraft: {
          ...oldData.boardCard.emailDraft,
          fileAttachments: oldData.boardCard.emailDraft.fileAttachments.filter((fa) => fa.id !== fileAttachmentId),
        },
      },
    } satisfies typeof oldData;
  });
};

export const addEmailMessageData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, emailMessage },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; emailMessage: EmailMessage };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return { ...oldData, emailMessagesAsc: [...oldData.emailMessagesAsc, emailMessage] } satisfies typeof oldData;
  });
};

export const addFakeCommentData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, text },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; text: string };
}) => {
  const currentUser = queryClient.getQueryData(trpc.user.getCurrentUser.queryKey())?.currentUser;

  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData || !currentUser) return oldData;
    const newComment = {
      id: 'fake-id',
      boardCardId,
      user: currentUser,
      text,
      createdAt: new Date(),
      editedAt: undefined,
    };
    return { ...oldData, commentsAsc: [...oldData.commentsAsc, newComment] } satisfies typeof oldData;
  });
};

export const replaceFakeCommentData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, comment },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; comment: Comment };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      commentsAsc: oldData.commentsAsc.map((c) => (c.id === 'fake-id' ? comment : c)),
    } satisfies typeof oldData;
  });
};

export const replaceBoardCardData = ({
  trpc,
  queryClient,
  params: { boardId, boardCard },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCard: BoardCard };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId: boardCard.id }), (oldData) => {
    if (!oldData) return oldData;
    return { ...oldData, boardCard } satisfies typeof oldData;
  });
};
