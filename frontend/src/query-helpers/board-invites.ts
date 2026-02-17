import type { QueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import type { TrpcProxy } from '@/trpc';

export type BoardInvitesData = inferRouterOutputs<TRPCRouter>['boardInvite']['getBoardInvites'];
export type BoardInvite = BoardInvitesData['boardInvites'][number];

const queryKey = (trpc: TrpcProxy, params: { boardId: string }) => {
  return trpc.boardInvite.getBoardInvites.queryKey(params);
};

export const setBoardInviteRoleData = ({
  trpc,
  queryClient,
  params: { boardId, boardInviteId, role },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardInviteId: string; role: BoardInvite['role'] };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardInvites: oldData.boardInvites.map((i) => (i.id === boardInviteId ? { ...i, role } : i)),
    } satisfies typeof oldData;
  });
};

export const addBoardInviteData = ({
  trpc,
  queryClient,
  params: { boardId, boardInvite },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardInvite: BoardInvite };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardInvites: [...oldData.boardInvites, boardInvite],
    } satisfies typeof oldData;
  });
};

export const removeBoardInviteData = ({
  trpc,
  queryClient,
  params: { boardId, boardInviteId },
}: {
  trpc: TrpcProxy;
  queryClient: QueryClient;
  params: { boardId: string; boardInviteId: string };
}) => {
  queryClient.setQueryData(queryKey(trpc, { boardId }), (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      boardInvites: oldData.boardInvites.filter((i) => i.id !== boardInviteId),
    } satisfies typeof oldData;
  });
};
