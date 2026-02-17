import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { Ellipsis, Link2, ListFilter } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type BoardFilters, BoardFiltersProvider, useBoardFilters } from '@/hooks/use-board-filters';
import { useRouteContext } from '@/hooks/use-route-context';
import { isSsr } from '@/utils/ssr';
import { ROUTES } from '@/utils/urls';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type Board = BoardData['board'];
type GmailAccount = BoardData['gmailAccounts'][number];

export const LOCAL_STORAGE_KEY_FILTERS_PREFIX = 'board-filters';

const FilterButton = ({ gmailAccounts }: { gmailAccounts: GmailAccount[] }) => {
  const { filters, setFilters } = useBoardFilters();
  const hasActiveFilters = !!filters.unread || filters.gmailAccountIds.length > 0;
  const toggleEmailAccount = (accountId: string) => {
    setFilters({
      ...filters,
      gmailAccountIds: filters.gmailAccountIds.includes(accountId)
        ? filters.gmailAccountIds.filter((id) => id !== accountId)
        : [...filters.gmailAccountIds, accountId],
    });
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className={hasActiveFilters ? 'bg-border hover:bg-border' : ''}>
              <ListFilter className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Filters</TooltipContent>
      </Tooltip>
      <PopoverContent align="end">
        <div className="flex flex-col gap-4 px-2 pb-2">
          <h3 className="font-semibold text-sm text-center">Filters</h3>
          <div className="flex flex-col gap-2">
            <div className="text-2xs font-medium text-muted-foreground">Card status</div>
            <div className="flex flex-col gap-2.5">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={filters.unread}
                  onCheckedChange={(checked) => setFilters({ ...filters, unread: !!checked })}
                />
                <span>Unread</span>
              </Label>
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={filters.sent}
                  onCheckedChange={(checked) => setFilters({ ...filters, sent: !!checked })}
                />
                <span>Sent</span>
              </Label>
            </div>
          </div>
          {gmailAccounts.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-2xs font-medium text-muted-foreground">Email accounts</div>
              <div className="flex flex-col gap-2.5">
                {gmailAccounts.map((account) => (
                  <Label key={account.id} className="flex gap-2">
                    <Checkbox
                      checked={filters.gmailAccountIds.includes(account.id)}
                      onCheckedChange={() => toggleEmailAccount(account.id)}
                    />
                    <span>{account.email}</span>
                  </Label>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

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
          queryClient.removeQueries({ queryKey: trpc.board.getBoard.queryKey({ boardId: board.id }), exact: true });
          queryClient.removeQueries({ queryKey: trpc.user.getCurrentUser.queryKey(), exact: true });
          navigate({ to: ROUTES.WELCOME });
        } else {
          setFilters((prev) => ({
            ...prev,
            gmailAccountIds: prev.gmailAccountIds.filter((id) => id !== gmailAccount.id),
          }));
          queryClient.setQueryData(
            trpc.board.getBoard.queryKey({ boardId: board.id }),
            (oldData: BoardData | undefined) => {
              if (!oldData) return oldData;
              return { ...oldData, gmailAccounts: oldData.gmailAccounts.filter((a) => a.id !== gmailAccount.id) };
            },
          );
        }
        setOpen(false);
      },
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

const MenuButton = ({ board, gmailAccounts }: { board: Board; gmailAccounts: GmailAccount[] }) => {
  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Ellipsis className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setAccountsDialogOpen(true)}>
            <Link2 />
            Email accounts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {accountsDialogOpen && (
        <Dialog open={accountsDialogOpen} onOpenChange={setAccountsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email accounts</DialogTitle>
              <DialogDescription className="text-xs">
                Manage email accounts associated with this board. Add or remove accounts to control which emails appear
                in your board.
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
                    <RemoveAccountPopover
                      board={board}
                      gmailAccount={account}
                      isLastAccount={gmailAccounts.length === 1}
                    >
                      <Button variant="outline" size="sm">
                        Remove
                      </Button>
                    </RemoveAccountPopover>
                  </ItemActions>
                </Item>
              ))}
              <div className="w-fit mt-3">
                <Button variant="contrast" className="w-full" size="sm" asChild>
                  <a href={`${import.meta.env.VITE_API_ENDPOINT}/auth/google?boardId=${board.id}`}>Add new account</a>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export const BoardNavbar = ({
  board,
  gmailAccounts,
  children,
}: {
  board: Board;
  gmailAccounts: GmailAccount[];
  children?: React.ReactNode;
}) => {
  const [filters, setFilters] = useState<BoardFilters>({ unread: false, sent: false, gmailAccountIds: [] });
  // Load filters from localStorage
  useEffect(() => {
    const savedFiltersJson = !isSsr() && localStorage.getItem(`${LOCAL_STORAGE_KEY_FILTERS_PREFIX}-${board.id}`);
    if (savedFiltersJson) setFilters(JSON.parse(savedFiltersJson));
  }, [board.id]);

  // Update filters in localStorage
  useEffect(() => {
    if (!isSsr()) {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_FILTERS_PREFIX}-${board.id}`, JSON.stringify(filters));
    }
  }, [filters, board.id]);

  return (
    <BoardFiltersProvider value={{ filters, setFilters }}>
      <div className="border-b bg-background px-6 py-2.5 flex items-center justify-between">
        <h1 className="font-semibold">{board.name}</h1>
        <div className="flex items-center gap-2">
          <FilterButton gmailAccounts={gmailAccounts} />
          <MenuButton board={board} gmailAccounts={gmailAccounts} />
        </div>
      </div>
      {children}
    </BoardFiltersProvider>
  );
};
