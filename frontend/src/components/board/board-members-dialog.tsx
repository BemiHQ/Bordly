import { useMutation, useQuery } from '@tanstack/react-query';
import { BoardMemberRole } from 'bordly-backend/utils/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverNonTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useRouteContext } from '@/hooks/use-route-context';
import type { Board } from '@/query-helpers/board';
import { type BoardMember, removeBoardMemberData, setBoardMemberRoleData } from '@/query-helpers/board';
import {
  addBoardInviteData,
  type BoardInvite,
  removeBoardInviteData,
  setBoardInviteRoleData,
} from '@/query-helpers/board-invites';

const BoardMemberRoleSelect = ({
  board,
  boardMember,
  onRoleChange,
}: {
  board: Board;
  boardMember: BoardMember;
  onRoleChange: ({ userId, role }: { userId: string; role: BoardMemberRole }) => void;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const [showRemovePopover, setShowRemovePopover] = useState(false);
  const { user } = boardMember;

  const deleteMemberMutation = useMutation(
    trpc.boardMember.delete.mutationOptions({
      onSuccess: () => {
        removeBoardMemberData({ trpc, queryClient, params: { boardId: board.id, userId: user.id } });
        toast.success('Member removed successfully', { position: 'top-center' });
        setShowRemovePopover(false);
      },
      onError: () => toast.error('Failed to remove member. Please try again.', { position: 'top-center' }),
    }),
  );

  return (
    <Popover open={showRemovePopover} onOpenChange={setShowRemovePopover}>
      <PopoverNonTrigger asChild>
        <NativeSelect
          size="sm"
          value={boardMember.role}
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'REMOVE') {
              setShowRemovePopover(true);
              e.target.value = boardMember.role;
            } else {
              onRoleChange({ userId: user.id, role: value as BoardMemberRole });
            }
          }}
        >
          <NativeSelectOption value={BoardMemberRole.ADMIN}>Admin</NativeSelectOption>
          <NativeSelectOption value={BoardMemberRole.MEMBER}>Member</NativeSelectOption>
          <NativeSelectOption value="REMOVE">Remove</NativeSelectOption>
        </NativeSelect>
      </PopoverNonTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-sm">Remove member</h4>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove <strong>{user.fullName}</strong> from this board?
            </p>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMemberMutation.mutate({ boardId: board.id, userId: user.id })}
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
  );
};

const BoardInviteRoleSelect = ({
  board,
  invite,
  onRoleChange,
}: {
  board: Board;
  invite: BoardInvite;
  onRoleChange: ({ boardInviteId, role }: { boardInviteId: string; role: BoardMemberRole }) => void;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const [showRemovePopover, setShowRemovePopover] = useState(false);

  const deleteInviteMutation = useMutation(
    trpc.boardInvite.delete.mutationOptions({
      onSuccess: () => {
        removeBoardInviteData({ trpc, queryClient, params: { boardId: board.id, boardInviteId: invite.id } });
        toast.success('Invite removed successfully', { position: 'top-center' });
        setShowRemovePopover(false);
      },
      onError: () => toast.error('Failed to remove invite. Please try again.', { position: 'top-center' }),
    }),
  );

  return (
    <Popover open={showRemovePopover} onOpenChange={setShowRemovePopover}>
      <PopoverNonTrigger asChild>
        <NativeSelect
          size="sm"
          value={invite.role}
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'REMOVE') {
              setShowRemovePopover(true);
              e.target.value = invite.role;
            } else {
              onRoleChange({ boardInviteId: invite.id, role: value as BoardMemberRole });
            }
          }}
        >
          <NativeSelectOption value={BoardMemberRole.ADMIN}>Admin</NativeSelectOption>
          <NativeSelectOption value={BoardMemberRole.MEMBER}>Member</NativeSelectOption>
          <NativeSelectOption value="REMOVE">Remove</NativeSelectOption>
        </NativeSelect>
      </PopoverNonTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-sm">Remove invite</h4>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove the invite for <strong>{invite.email}</strong>?
            </p>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteInviteMutation.mutate({ boardId: board.id, boardInviteId: invite.id })}
            disabled={deleteInviteMutation.isPending}
          >
            {deleteInviteMutation.isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Removing...
              </>
            ) : (
              'Remove invite'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const BoardMembersDialog = ({
  board,
  boardMembers,
  open,
  onOpenChange,
}: {
  board: Board;
  boardMembers: BoardMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { queryClient, trpc, currentUser } = useRouteContext();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<BoardMemberRole>(BoardMemberRole.MEMBER);

  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    ...trpc.boardInvite.getBoardInvites.queryOptions({ boardId: board.id }),
    enabled: open,
  });

  const createInviteMutation = useMutation(
    trpc.boardInvite.create.mutationOptions({
      onSuccess: (data) => {
        addBoardInviteData({ trpc, queryClient, params: { boardId: board.id, boardInvite: data.boardInvite } });
        toast.success('Invite sent successfully', { position: 'top-center' });
        setInviteEmail('');
        setInviteRole(BoardMemberRole.MEMBER);
      },
      onError: () => toast.error('Failed to send invite. Please try again.', { position: 'top-center' }),
    }),
  );

  const optimisticallySetInviteRole = useOptimisticMutation({
    queryClient,
    queryKey: trpc.boardInvite.getBoardInvites.queryKey({ boardId: board.id }),
    onExecute: ({ boardInviteId, role }) =>
      setBoardInviteRoleData({ trpc, queryClient, params: { boardId: board.id, boardInviteId, role } }),
    successToast: 'Role updated successfully',
    errorToast: 'Failed to update the role. Please try again.',
    mutation: useMutation(trpc.boardInvite.setRole.mutationOptions()),
  });

  const optimisticallySetMemberRole = useOptimisticMutation({
    queryClient,
    queryKey: trpc.board.get.queryKey({ boardId: board.id }),
    onExecute: ({ userId, role }) =>
      setBoardMemberRoleData({ trpc, queryClient, params: { boardId: board.id, userId, role } }),
    successToast: 'Role updated successfully',
    errorToast: 'Failed to update the role. Please try again.',
    mutation: useMutation(trpc.boardMember.setRole.mutationOptions()),
  });

  if (!currentUser) return null;

  const handleRoleChange = ({ userId, role }: { userId: string; role: BoardMemberRole }) => {
    optimisticallySetMemberRole({ boardId: board.id, userId, role });
  };

  const handleInviteRoleChange = ({ boardInviteId, role }: { boardInviteId: string; role: BoardMemberRole }) => {
    optimisticallySetInviteRole({ boardId: board.id, boardInviteId, role });
  };

  const handleSendInvite = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address', { position: 'top-center' });
      return;
    }
    createInviteMutation.mutate({ boardId: board.id, email: inviteEmail, role: inviteRole });
  };

  const currentUserMember = boardMembers.find((m) => m.user.id === currentUser.id);
  const isCurrentUserAdmin = currentUserMember?.role === BoardMemberRole.ADMIN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Board members</DialogTitle>
          <DialogDescription className="text-xs">
            Manage members and their roles. Admins can update roles and remove members.
          </DialogDescription>
        </DialogHeader>

        {isCurrentUserAdmin && (
          <div className="flex gap-2 pt-1">
            <Input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              inputSize="sm"
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendInvite();
                }
              }}
            />
            <NativeSelect
              size="sm"
              value={inviteRole}
              className="w-26"
              onChange={(e) => setInviteRole(e.target.value as BoardMemberRole)}
            >
              <NativeSelectOption value={BoardMemberRole.ADMIN}>Admin</NativeSelectOption>
              <NativeSelectOption value={BoardMemberRole.MEMBER}>Member</NativeSelectOption>
            </NativeSelect>
            <Button variant="contrast" size="sm" onClick={handleSendInvite} disabled={createInviteMutation.isPending}>
              {createInviteMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Inviting...
                </>
              ) : (
                'Invite'
              )}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1 pb-2">
          {invitesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="text-xs font-medium">People with access</div>
              {boardMembers.map((member) => (
                <Item key={member.user.id} variant="outline" className="py-2">
                  <ItemMedia>
                    <Avatar>
                      <AvatarImage src={member.user.photoUrl} alt={member.user.fullName} />
                    </Avatar>
                  </ItemMedia>
                  <ItemContent className="gap-0">
                    <ItemTitle>{`${member.user.fullName}${member.user.id === currentUser.id ? ' (you)' : ''}`}</ItemTitle>
                    <ItemDescription className="text-2xs">{member.user.email}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {isCurrentUserAdmin && member.user.id !== currentUser.id && !member.isAgent ? (
                      <BoardMemberRoleSelect board={board} boardMember={member} onRoleChange={handleRoleChange} />
                    ) : (
                      <div className="text-xs text-muted-foreground capitalize px-3">
                        {member.isAgent ? 'AI Agent' : member.role.toLowerCase()}
                      </div>
                    )}
                  </ItemActions>
                </Item>
              ))}
              {invitesData?.boardInvites.map((invite) => (
                <Item key={invite.id} variant="outline" className="py-2">
                  <ItemMedia>
                    <Avatar>
                      <AvatarFallback hashForBgColor={invite.email}>
                        {invite.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent className="gap-0">
                    <ItemTitle>{invite.email}</ItemTitle>
                    <ItemDescription className="text-2xs">Pending invite</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {isCurrentUserAdmin ? (
                      <BoardInviteRoleSelect board={board} invite={invite} onRoleChange={handleInviteRoleChange} />
                    ) : (
                      <div className="text-xs text-muted-foreground capitalize px-3">{invite.role.toLowerCase()}</div>
                    )}
                  </ItemActions>
                </Item>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
