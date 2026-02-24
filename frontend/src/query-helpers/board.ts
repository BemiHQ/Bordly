import type { QueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import type { TrpcProxy } from '@/trpc';

export type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
export type Board = BoardData['board'];
export type BoardColumn = BoardData['boardColumnsAsc'][number];
export type BoardAccount = BoardData['boardAccounts'][number];
export type BoardMember = BoardData['boardMembers'][number];

export type User = BoardMember['user'];
export type BoardMemberRole = BoardMember['role'];

const queryKey = (trpc: TrpcProxy, params: { boardId: string }) => {
  return trpc.board.get.queryKey(params);
};

export const solo = (boardMembers: BoardMember[]) => {
  return boardMembers.filter((m) => !m.isAgent).length === 1;
};

export const setReceivingEmailsToBoardAccountData = ({
  trpc,
  queryClient,
  params: { boardId, boardAccountId, receivingEmails },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardAccountId: string; receivingEmails?: string[] };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardAccounts: oldData.boardAccounts.map((a) => (a.id === boardAccountId ? { ...a, receivingEmails } : a)),
    } satisfies typeof oldData;
  });
};

export const removeBoardAccountData = ({
  trpc,
  queryClient,
  params: { boardId, boardAccountId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardAccountId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardAccounts: oldData.boardAccounts.filter((a) => a.id !== boardAccountId),
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

export const addFakeBoardColumnData = ({
  trpc,
  queryClient,
  params: { boardId, name, position },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; name: string; position: number };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardColumnsAsc: [...oldData.boardColumnsAsc, { id: 'fake-id', name, position }],
    } satisfies typeof oldData;
  });
};

export const replaceFakeBoardColumnData = ({
  trpc,
  queryClient,
  params: { boardId, boardColumn },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardColumn: BoardColumn };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardColumnsAsc: oldData.boardColumnsAsc.map((col) => (col.id === 'fake-id' ? boardColumn : col)),
    } satisfies typeof oldData;
  });
};

export const removeBoardColumnData = ({
  trpc,
  queryClient,
  params: { boardId, boardColumnId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardColumnId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardColumnsAsc: oldData.boardColumnsAsc.filter((col) => col.id !== boardColumnId),
    } satisfies typeof oldData;
  });
};
