import type { QueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import type { TrpcProxy } from '@/trpc';

export type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
export type Board = BoardData['board'];
export type BoardColumn = BoardData['boardColumnsAsc'][number];
export type GmailAccount = BoardData['gmailAccounts'][number];
export type BoardMember = BoardData['boardMembers'][number];

export type BoardMemberRole = BoardMember['role'];

const queryKey = (trpc: TrpcProxy, params: { boardId: string }) => {
  return trpc.board.get.queryKey(params);
};

export const solo = (boardMembers: BoardMember[]) => {
  return boardMembers.filter((m) => !m.isAgent).length === 1;
};

export const removeGmailAccountData = ({
  trpc,
  queryClient,
  params: { boardId, gmailAccountId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; gmailAccountId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      gmailAccounts: oldData.gmailAccounts.filter((a) => a.id !== gmailAccountId),
    } satisfies typeof oldData;
  });
};

export const renameBoardColumnData = ({
  trpc,
  queryClient,
  params: { boardId, boardColumnId, name },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardColumnId: string; name: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardColumnsAsc: oldData.boardColumnsAsc.map((col) => (col.id === boardColumnId ? { ...col, name } : col)),
    } satisfies typeof oldData;
  });
};

export const reorderBoardColumnsData = ({
  trpc,
  queryClient,
  params: { boardId, boardColumnId, position },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardColumnId: string; position: number };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    const columnsCopy = [...oldData.boardColumnsAsc];

    const columnIndex = columnsCopy.findIndex((col) => col.id === boardColumnId);
    const [movedColumn] = columnsCopy.splice(columnIndex, 1);
    columnsCopy.splice(position, 0, movedColumn);

    const reorderedColumns = columnsCopy.map((col, index) => ({ ...col, position: index }));
    return { ...oldData, boardColumnsAsc: reorderedColumns } satisfies typeof oldData;
  });
};

export const renameBoardData = ({
  trpc,
  queryClient,
  params: { boardId, name },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; name: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return { ...oldData, board: { ...oldData.board, name } } satisfies typeof oldData;
  });
};

export const setBoardMemberRoleData = ({
  trpc,
  queryClient,
  params: { boardId, userId, role },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; userId: string; role: BoardMemberRole };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardMembers: oldData.boardMembers.map((m) => (m.user.id === userId ? { ...m, role } : m)),
    } satisfies typeof oldData;
  });
};

export const removeBoardMemberData = ({
  trpc,
  queryClient,
  params: { boardId, userId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; userId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardMembers: oldData.boardMembers.filter((m) => m.user.id !== userId),
    } satisfies typeof oldData;
  });
};
