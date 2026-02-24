import type { QueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import type { TrpcProxy } from '@/trpc';

export type BoardCardData = inferRouterOutputs<TRPCRouter>['boardCard']['get'];

export type BoardCard = BoardCardData['boardCard'];
export type EmailMessage = BoardCardData['emailMessagesAsc'][number];
export type Comment = BoardCardData['commentsAsc'][number];

export type EmailDraft = BoardCard['emailDraft'];
export type FileAttachment = NonNullable<EmailDraft>['fileAttachments'][number];

export type GmailAttachment = EmailMessage['gmailAttachments'][number];

const queryKey = (trpc: TrpcProxy, params: { boardId: string; boardCardId: string }) => {
  return trpc.boardCard.get.queryKey(params);
};

export const setAssignedBoardMemberData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, assignedBoardMemberId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; assignedBoardMemberId: string | null };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCard: { ...oldData.boardCard, assignedBoardMemberId: assignedBoardMemberId || undefined },
    } satisfies typeof oldData;
  });
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

export const replaceBoardColumnIdData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, boardColumnId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; boardColumnId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return { ...oldData, boardCard: { ...oldData.boardCard, boardColumnId } } satisfies typeof oldData;
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

export const updateCommentData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, commentId, text },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; commentId: string; text: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      commentsAsc: oldData.commentsAsc.map((c) => (c.id === commentId ? { ...c, text, editedAt: new Date() } : c)),
    } satisfies typeof oldData;
  });
};

export const removeCommentData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, commentId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; commentId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      commentsAsc: oldData.commentsAsc.filter((c) => c.id !== commentId),
    } satisfies typeof oldData;
  });
};

export const addBordlyThinkingComment = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, bordlyUser },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; bordlyUser: Comment['user'] };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    const thinkingComment = {
      id: 'bordly-thinking',
      boardCardId,
      user: bordlyUser,
      text: 'Thinking...',
      createdAt: new Date(),
      editedAt: undefined,
    };
    return { ...oldData, commentsAsc: [...oldData.commentsAsc, thinkingComment] } satisfies typeof oldData;
  });
};

export const removeBordlyThinkingComment = ({
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
    return {
      ...oldData,
      commentsAsc: oldData.commentsAsc.filter((c) => c.id !== 'bordly-thinking'),
    } satisfies typeof oldData;
  });
};

export const setBoardCardSubjectData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, subject },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; subject: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId }), (oldData) => {
    if (!oldData) return oldData;
    return { ...oldData, boardCard: { ...oldData.boardCard, subject } } satisfies typeof oldData;
  });
};

export const addBoardCardData = ({
  trpc,
  queryClient,
  params: { boardId, boardCard },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCard: BoardCard };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId, boardCardId: boardCard.id }), (_oldData) => {
    return { boardCard, emailMessagesAsc: [], commentsAsc: [] } satisfies typeof _oldData;
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
