import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { BoardMemberRole } from 'bordly-backend/utils/shared';
import { useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useRouteContext } from '@/hooks/use-route-context';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type Board = BoardData['board'];

const BoardMemberRoleSelect = ({
  board,
  member,
  onRoleChange,
}: {
  board: Board;
  member: { user: { id: string; name: string; photoUrl: string }; role: string };
  onRoleChange: ({ userId, role }: { userId: string; role: BoardMemberRole }) => void;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const [showRemovePopover, setShowRemovePopover] = useState(false);

  const deleteMemberMutation = useMutation(
    trpc.boardMember.delete.mutationOptions({
      onSuccess: () => {
        queryClient.setQueryData(trpc.boardMember.getBoardMembers.queryKey({ boardId: board.id }), (oldData) => {
          if (!oldData) return oldData;
          return { boardMembers: oldData.boardMembers.filter((m) => m.user.id !== member.user.id) };
        });
        toast.success('Member removed successfully', { position: 'top-center' });
        setShowRemovePopover(false);
      },
      onError: () => toast.error('Failed to remove member. Please try again.', { position: 'top-center' }),
    }),
  );

  return (
    <>
      <NativeSelect
        size="sm"
        value={member.role}
        onChange={(e) => {
          const value = e.target.value;
          if (value === 'REMOVE') {
            setShowRemovePopover(true);
            e.target.value = member.role;
          } else {
            onRoleChange({ userId: member.user.id, role: value as BoardMemberRole });
          }
        }}
      >
        <NativeSelectOption value={BoardMemberRole.ADMIN}>Admin</NativeSelectOption>
        <NativeSelectOption value={BoardMemberRole.MEMBER}>Member</NativeSelectOption>
        <NativeSelectOption value="REMOVE">Remove</NativeSelectOption>
      </NativeSelect>
      <Popover open={showRemovePopover} onOpenChange={setShowRemovePopover}>
        <PopoverTrigger asChild>
          <div className="hidden" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-sm">Remove member</h4>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to remove <strong>{member.user.name}</strong> from this board?
              </p>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMemberMutation.mutate({ boardId: board.id, userId: member.user.id })}
              disabled={deleteMemberMutation.isPending}
            >
              {deleteMemberMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Removing...
                </>
              ) : (
                'Remove member'
              )}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};

export const BoardMembersDialog = ({
  board,
  currentUserId,
  open,
  onOpenChange,
}: {
  board: Board;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const { data, isLoading } = useQuery({
    ...trpc.boardMember.getBoardMembers.queryOptions({ boardId: board.id }),
    enabled: open,
  });

  const currentUserMember = data?.boardMembers.find((m) => m.user.id === currentUserId);
  const isCurrentUserAdmin = currentUserMember?.role === BoardMemberRole.ADMIN;

  const optimisticallySetRole = useOptimisticMutation({
    queryClient,
    queryKey: trpc.boardMember.getBoardMembers.queryKey({ boardId: board.id }),
    onExecute: ({ userId, role }) => {
      queryClient.setQueryData(trpc.boardMember.getBoardMembers.queryKey({ boardId: board.id }), (oldData) => {
        if (!oldData) return oldData;
        return { boardMembers: oldData.boardMembers.map((m) => (m.user.id === userId ? { ...m, role: role } : m)) };
      });
    },
    errorToast: 'Failed to update the role. Please try again.',
    mutation: useMutation(trpc.boardMember.setRole.mutationOptions()),
  });

  const handleRoleChange = ({ userId, role }: { userId: string; role: BoardMemberRole }) => {
    optimisticallySetRole({ boardId: board.id, userId, role });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Board members</DialogTitle>
          <DialogDescription className="text-xs">
            Manage members and their roles. Admins can update roles and remove members.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            data?.boardMembers.map((member) => (
              <Item key={member.user.id} variant="outline" className="py-2">
                <ItemMedia>
                  <Avatar>
                    <AvatarImage src={member.user.photoUrl} alt={member.user.name} />
                  </Avatar>
                </ItemMedia>
                <ItemContent className="gap-0">
                  <ItemTitle>{member.user.name}</ItemTitle>
                  <ItemDescription className="text-2xs">{member.user.id === currentUserId && 'You'}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {isCurrentUserAdmin && member.user.id !== currentUserId ? (
                    <BoardMemberRoleSelect board={board} member={member} onRoleChange={handleRoleChange} />
                  ) : (
                    <div className="text-xs text-muted-foreground capitalize px-3">{member.role.toLowerCase()}</div>
                  )}
                </ItemActions>
              </Item>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
