import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { Ellipsis, Link2, ListFilter } from 'lucide-react';
import { useState } from 'react';

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['getBoard'];
type Board = BoardData['board'];
type GmailAccount = BoardData['gmailAccounts'][number];

export const LOCAL_STORAGE_KEY_FILTERS_PREFIX = 'board-filters';
export interface BoardFilters {
  unread: boolean;
  gmailAccountIds: string[];
}

const FilterButton = ({
  gmailAccounts,
  filters,
  setFilters,
}: {
  gmailAccounts: GmailAccount[];
  filters: BoardFilters;
  setFilters: (value: BoardFilters) => void;
}) => {
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
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.unread}
                onCheckedChange={(checked) => setFilters({ ...filters, unread: !!checked })}
              />
              <span className="text-xs">Unread</span>
            </label>
          </div>
          {gmailAccounts.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-2xs font-medium text-muted-foreground">Email accounts</div>
              <div className="flex flex-col gap-2.5">
                {gmailAccounts.map((account) => (
                  <label key={account.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={filters.gmailAccountIds.includes(account.id)}
                      onCheckedChange={() => toggleEmailAccount(account.id)}
                    />
                    <span className="text-xs">{account.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
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
                    <Button variant="outline" size="sm">
                      Remove
                    </Button>
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
  filters,
  setFilters,
}: {
  board: Board;
  gmailAccounts: GmailAccount[];
  filters: BoardFilters;
  setFilters: (value: BoardFilters) => void;
}) => {
  return (
    <div className="border-b bg-background px-6 py-2.5 flex items-center justify-between">
      <h1 className="font-semibold">{board.name}</h1>
      <div className="flex items-center gap-2">
        <FilterButton gmailAccounts={gmailAccounts} filters={filters} setFilters={setFilters} />
        <MenuButton board={board} gmailAccounts={gmailAccounts} />
      </div>
    </div>
  );
};
