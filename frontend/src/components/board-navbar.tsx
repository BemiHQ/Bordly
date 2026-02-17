import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { Ellipsis, Link2, ListFilter, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BoardMembersDialog } from '@/components/board-members-dialog';
import { EmailAccountsDialog } from '@/components/email-accounts-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type BoardFilters, BoardFiltersProvider, useBoardFilters } from '@/hooks/use-board-filters';
import { isSsr } from '@/utils/ssr';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
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

const MenuButton = ({
  board,
  gmailAccounts,
  currentUserId,
}: {
  board: Board;
  gmailAccounts: GmailAccount[];
  currentUserId: string;
}) => {
  const [accountsDialogOpen, setAccountsDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Ellipsis className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setMembersDialogOpen(true)}>
            <UsersRound />
            Board members
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAccountsDialogOpen(true)}>
            <Link2 />
            Email accounts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EmailAccountsDialog
        board={board}
        gmailAccounts={gmailAccounts}
        open={accountsDialogOpen}
        onOpenChange={setAccountsDialogOpen}
      />
      <BoardMembersDialog
        board={board}
        currentUserId={currentUserId}
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
      />
    </>
  );
};

export const BoardNavbar = ({
  board,
  gmailAccounts,
  currentUserId,
  children,
}: {
  board: Board;
  gmailAccounts: GmailAccount[];
  currentUserId: string;
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
          <MenuButton board={board} gmailAccounts={gmailAccounts} currentUserId={currentUserId} />
        </div>
      </div>
      {children}
    </BoardFiltersProvider>
  );
};
