import type { QueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import type { TrpcProxy } from '@/trpc';

export type BoardCardsData = inferRouterOutputs<TRPCRouter>['boardCard']['getBoardCards'];
export type BoardCard = BoardCardsData['boardCardsDesc'][number];

const queryKey = (trpc: TrpcProxy, params: { boardId: string }) => {
  return trpc.boardCard.getBoardCards.queryKey(params);
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
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCardId ? { ...c, subject } : c)),
    } satisfies typeof oldData;
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
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: [boardCard, ...oldData.boardCardsDesc],
    } satisfies typeof oldData;
  });
};

export const setBoardCardAssignedBoardMemberData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, assignedBoardMemberId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; assignedBoardMemberId: string | null };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.map((c) =>
        c.id === boardCardId ? { ...c, assignedBoardMemberId: assignedBoardMemberId || undefined } : c,
      ),
    } satisfies typeof oldData;
  });
};

export const setBoardCardEmailDraftData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, emailDraft },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; emailDraft: BoardCard['emailDraft'] };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCardId ? { ...c, emailDraft } : c)),
    } satisfies typeof oldData;
  });
};

export const removeBoardCardEmailDraftData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCardId ? { ...c, emailDraft: undefined } : c)),
    } satisfies typeof oldData;
  });
};

export const setUnreadBoardCardData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, unread },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; unread: boolean };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCardId ? { ...c, unread } : c)),
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
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCard.id ? boardCard : c)),
    } satisfies typeof oldData;
  });
};

export const removeBoardCardData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.filter((card) => card.id !== boardCardId),
    } satisfies typeof oldData;
  });
};

export const changeBoardCardColumnData = ({
  trpc,
  queryClient,
  params: { boardId, boardCardId, boardColumnId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardCardId: string; boardColumnId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardCardsDesc: oldData.boardCardsDesc.map((c) => (c.id === boardCardId ? { ...c, boardColumnId } : c)),
    } satisfies typeof oldData;
  });
};
