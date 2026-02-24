import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useBoardFilters } from '@/hooks/use-board-filters';
import { useRouteContext } from '@/hooks/use-route-context';
import {
  type Board,
  type BoardAccount,
  removeBoardAccountData,
  setReceivingEmailsToBoardAccountData,
} from '@/query-helpers/board';
import { removeBoardCardsByBoardAccountIdData } from '@/query-helpers/board-cards';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

const RemoveAccountPopover = ({
  board,
  boardAccount,
  isLastAccount,
  children,
}: {
  board: Board;
  boardAccount: BoardAccount;
  isLastAccount: boolean;
  children: React.ReactNode;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const { setFilters } = useBoardFilters();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { gmailAccount } = boardAccount;
  const boardAccountId = boardAccount.id;

  const deleteAccountMutation = useMutation(
    trpc.board.deleteBoardAccount.mutationOptions({
      onSuccess: () => {
        if (isLastAccount) {
          queryClient.removeQueries({ queryKey: trpc.board.get.queryKey({ boardId: board.id }), exact: true });
          queryClient.removeQueries({ queryKey: trpc.user.getCurrentUser.queryKey(), exact: true });
          navigate({ to: ROUTES.WELCOME });
        } else {
          setFilters((prev) => ({
            ...prev,
            boardAccountIds: prev.boardAccountIds.filter((id) => id !== boardAccount.id),
          }));
          removeBoardAccountData({ trpc, queryClient, params: { boardId: board.id, boardAccountId } });
          removeBoardCardsByBoardAccountIdData({ trpc, queryClient, params: { boardId: board.id, boardAccountId } });
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
            onClick={() => deleteAccountMutation.mutate({ boardId: board.id, boardAccountId })}
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

const EditReceivingEmailsPopover = ({
  board,
  boardAccount,
  children,
}: {
  board: Board;
  boardAccount: BoardAccount;
  children: React.ReactNode;
}) => {
  const { queryClient, trpc } = useRouteContext();
  const [open, setOpen] = useState(false);
  const [receivingEmails, setReceivingEmails] = useState(
    boardAccount.receivingEmails ? boardAccount.receivingEmails.join(', ') : '',
  );

  let emailsToSubmit: string[] | undefined = receivingEmails
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email);

  if (emailsToSubmit.length === 0) {
    emailsToSubmit = undefined;
  }

  const boardAccountId = boardAccount.id;

  const editBoardAccountMutation = useMutation(
    trpc.boardAccount.edit.mutationOptions({
      onSuccess: () => {
        setReceivingEmailsToBoardAccountData({
          trpc,
          queryClient,
          params: { boardId: board.id, boardAccountId, receivingEmails: emailsToSubmit },
        });
        setOpen(false);
      },
      onError: () => toast.error('Failed to update receiving emails. Please try again.', { position: 'top-center' }),
    }),
  );

  const handleSave = () => {
    editBoardAccountMutation.mutate({ boardId: board.id, boardAccountId, receivingEmails: emailsToSubmit });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-sm">Edit receiving emails</h4>
            <p className="text-xs text-muted-foreground">
              {boardAccount.receivingEmails
                ? 'Specify email addresses to sync. Leave empty to sync all emails.'
                : 'Currently syncing all emails. Add specific addresses to filter instead.'}
            </p>
          </div>

          <Textarea
            placeholder="team@example.com, support@example.com"
            className="min-h-20 text-xs"
            value={receivingEmails}
            onChange={(e) => setReceivingEmails(e.target.value)}
          />

          <Button variant="default" size="sm" onClick={handleSave} disabled={editBoardAccountMutation.isPending}>
            {editBoardAccountMutation.isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const EmailAccountsDialog = ({
  board,
  boardAccounts,
  open,
  onOpenChange,
}: {
  board: Board;
  boardAccounts: BoardAccount[];
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
          {boardAccounts.map((account) => (
            <Item key={account.id} variant="outline" className="py-2">
              <ItemMedia variant="image">
                <img src="/domain-icons/gmail.com.ico" alt={account.gmailAccount.name} className="size-9 pb-0.5" />
              </ItemMedia>
              <ItemContent className="gap-0.5">
                <ItemTitle>{account.gmailAccount.email}</ItemTitle>
                <ItemDescription className="text-2xs">
                  {account.receivingEmails ? account.receivingEmails.join(', ') : 'All emails'}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="gap-2">
                <EditReceivingEmailsPopover board={board} boardAccount={account}>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </EditReceivingEmailsPopover>
                <RemoveAccountPopover board={board} boardAccount={account} isLastAccount={boardAccounts.length === 1}>
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
