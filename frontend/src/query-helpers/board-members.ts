import type { QueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import type { TrpcProxy } from '@/trpc';

export type BoardMembersData = inferRouterOutputs<TRPCRouter>['boardMember']['getBoardMembers'];
export type BoardMember = BoardMembersData['boardMembers'][number];
export type BoardMemberRole = BoardMember['role'];

const queryKey = (trpc: TrpcProxy, params: { boardId: string }) => {
  return trpc.boardMember.getBoardMembers.queryKey(params);
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
