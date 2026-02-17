import { Link } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { API_ENDPOINTS, ROUTES } from '@/utils/urls';

export const Navbar = ({ currentUser }: { currentUser: { name: string; photoUrl: string } }) => {
  const initals = currentUser.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <nav className="border-b px-6 py-3 bg-secondary border-border">
      <div className="flex items-center justify-between h-8">
        <Link to={ROUTES.HOME} className="flex items-center gap-2">
          <img src="/images/logo.png" alt="Bordly Logo" className="w-6 h-6" />
          <span className="font-semibold">Bordly</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="size-7">
                <AvatarImage src={currentUser.photoUrl} alt={currentUser.name} />
                <AvatarFallback>{initals}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
