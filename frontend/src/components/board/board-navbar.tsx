import { useMutation } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { Ellipsis, Link2, ListFilter, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BoardMembersDialog } from '@/components/board/board-members-dialog';
import { EmailAccountsDialog } from '@/components/board/email-accounts-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type BoardFilters, BoardFiltersProvider, useBoardFilters } from '@/hooks/use-board-filters';
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
import { useRouteContext } from '@/hooks/use-route-context';
import { isSsr } from '@/utils/ssr';
import { cn } from '@/utils/strings';

type BoardData = inferRouterOutputs<TRPCRouter>['board']['get'];
type Board = BoardData['board'];
type GmailAccount = BoardData['gmailAccounts'][number];

export const LOCAL_STORAGE_KEY_FILTERS_PREFIX = 'board-filters';

const FilterButton = ({ gmailAccounts }: { gmailAccounts: GmailAccount[] }) => {
  const { filters, setFilters } = useBoardFilters();
  const hasActiveFilters =
    filters.unread || filters.hasAttachments || filters.draft || filters.gmailAccountIds.length > 0;
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
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn('px-2', hasActiveFilters && 'bg-border hover:bg-border')}
            >
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
                  checked={filters.draft}
                  onCheckedChange={(checked) => setFilters({ ...filters, draft: !!checked })}
                />
                <span>Draft</span>
              </Label>
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={filters.hasAttachments}
                  onCheckedChange={(checked) => setFilters({ ...filters, hasAttachments: !!checked })}
                />
                <span>Has attachment</span>
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
          <Button variant="ghost" size="icon-sm" className="px-2">
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
  const [filters, setFilters] = useState<BoardFilters>({
    unread: false,
    hasAttachments: false,
    draft: false,
    gmailAccountIds: [],
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(board.name);
  const { queryClient, trpc } = useRouteContext();

  const boardQueryKey = trpc.board.get.queryKey({ boardId: board.id });
  const optimisticallySetName = useOptimisticMutation({
    queryClient,
    queryKey: boardQueryKey,
    onExecute: ({ name }) => {
      queryClient.setQueryData(boardQueryKey, (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, board: { ...oldData.board, name } } satisfies typeof oldData;
      });
    },
    errorToast: 'Failed to rename board. Please try again.',
    mutation: useMutation(trpc.board.setName.mutationOptions()),
  });

  const handleNameClick = () => {
    setIsEditing(true);
    setEditedName(board.name);
  };

  const handleNameSubmit = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== board.name) {
      optimisticallySetName({ boardId: board.id, name: trimmedName });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedName(board.name);
    }
  };

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
        {isEditing ? (
          <Input
            inputSize="sm"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className="bg-background text-base font-semibold rounded-sm focus-visible:ring-1 w-fit px-2 ml-[-9px] mt-[-1px] bg-white"
            autoFocus
          />
        ) : (
          <h1 className="font-semibold cursor-pointer hover:text-primary" onClick={handleNameClick}>
            {board.name}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <FilterButton gmailAccounts={gmailAccounts} />
          <MenuButton board={board} gmailAccounts={gmailAccounts} currentUserId={currentUserId} />
        </div>
      </div>
      {children}
    </BoardFiltersProvider>
  );
};
