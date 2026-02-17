import { Link } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { TRPCRouter } from 'bordly-backend/trpc-router';
import { LogOutIcon } from 'lucide-react';

import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

type CurrentUser = NonNullable<inferRouterOutputs<TRPCRouter>['user']['getCurrentUser']['currentUser']>;

export const Navbar = ({ currentUser }: { currentUser: CurrentUser }) => {
  return (
    <nav className="border-b px-6 py-3 bg-secondary border-border">
      <div className="flex items-center justify-between h-4">
        <Link to={ROUTES.HOME} className="flex items-center gap-2">
          <img src="/images/logo.png" alt="Bordly Logo" className="w-5 h-5" />
          <span className="font-semibold text-sm">Bordly</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:ring-0" asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar size="sm">
                <AvatarImage src={currentUser.photoUrl} alt={currentUser.name} />
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="p-2 flex items-center gap-2.5">
              <Avatar>
                <AvatarImage src={currentUser.photoUrl} alt={currentUser.name} />
              </Avatar>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium leading-none">{currentUser.name}</span>
                <span className="text-xs text-muted-foreground leading-none">{currentUser.email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={API_ENDPOINTS.AUTH_LOG_OUT}>
                <LogOutIcon />
                Log out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};
