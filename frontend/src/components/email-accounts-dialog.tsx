import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { useBoardFilters } from '@/hooks/use-board-filters';
import { useRouteContext } from '@/hooks/use-route-context';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
type Board = BoardData['board'];
type GmailAccount = BoardData['gmailAccounts'][number];

const RemoveAccountPopover = ({
  board,
  gmailAccount,
  isLastAccount,
  children,
}: {
  board: Board;
  gmailAccount: GmailAccount;
  isLastAccount: boolean;
  children: React.ReactNode;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const { setFilters } = useBoardFilters();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const deleteAccountMutation = useMutation(
    trpc.board.deleteGmailAccount.mutationOptions({
      onSuccess: () => {
        if (isLastAccount) {
          queryClient.removeQueries({ queryKey: trpc.board.get.queryKey({ boardId: board.id }), exact: true });
          queryClient.removeQueries({ queryKey: trpc.user.getCurrentUser.queryKey(), exact: true });
          navigate({ to: ROUTES.WELCOME });
        } else {
          setFilters((prev) => ({
            ...prev,
            gmailAccountIds: prev.gmailAccountIds.filter((id) => id !== gmailAccount.id),
          }));
          // Remove the deleted account from the board data in the cache
          queryClient.setQueryData(trpc.board.get.queryKey({ boardId: board.id }), (oldData: BoardData | undefined) => {
            if (!oldData) return oldData;
            return { ...oldData, gmailAccounts: oldData.gmailAccounts.filter((a) => a.id !== gmailAccount.id) };
          });
          toast.success('Email account removed successfully', { position: 'top-center' });
        }
        setOpen(false);
      },
      onError: () => toast.error('Failed to remove email account. Please try again.', { position: 'top-center' }),
    }),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-sm">Remove email account</h4>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to remove <strong>{gmailAccount.email}</strong> and all its associated emails from
              this board?
              {isLastAccount && ' This is the last account and removing it will delete the board.'}
            </p>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteAccountMutation.mutate({ boardId: board.id, gmailAccountId: gmailAccount.id })}
            disabled={deleteAccountMutation.isPending}
          >
            {deleteAccountMutation.isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Removing...
              </>
            ) : (
              'Remove account'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const EmailAccountsDialog = ({
  board,
  gmailAccounts,
  open,
  onOpenChange,
}: {
  board: Board;
  gmailAccounts: GmailAccount[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email accounts</DialogTitle>
          <DialogDescription className="text-xs">
            Manage email accounts associated with this board. Add or remove accounts to control which emails appear in
            your board.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1 pb-2">
          {gmailAccounts.map((account) => (
            <Item key={account.id} variant="outline" className="py-2">
              <ItemMedia variant="image">
                <img src="/domain-icons/gmail.com.ico" alt={account.name} className="size-9 pb-0.5" />
              </ItemMedia>
              <ItemContent className="gap-0">
                <ItemTitle>{account.name}</ItemTitle>
                <ItemDescription className="text-2xs">{account.email}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <RemoveAccountPopover board={board} gmailAccount={account} isLastAccount={gmailAccounts.length === 1}>
                  <Button variant="outline" size="sm">
                    Remove
                  </Button>
                </RemoveAccountPopover>
              </ItemActions>
            </Item>
          ))}
          <div className="w-fit mt-3">
            <Button variant="contrast" className="w-full" size="sm" asChild>
              <a href={`${API_ENDPOINTS.AUTH_GOOGLE}?boardId=${board.id}`}>Add new account</a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
