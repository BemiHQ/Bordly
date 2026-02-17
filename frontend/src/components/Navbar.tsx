import { Link } from '@tanstack/react-router';

import { ROUTES } from '@/utils/urls';

interface NavbarProps {
  currentUser: {
    name: string;
    photoUrl: string;
  };
}

export function Navbar({ currentUser }: NavbarProps) {
  return (
    <nav className="border-b px-6 py-3 bg-secondary">
      <div className="flex items-center justify-between">
        <Link to={ROUTES.HOME} className="flex items-center gap-2">
          <img src="/images/logo.png" alt="Bordly Logo" className="w-6 h-6" />
          <span className="font-semibold">Bordly</span>
        </Link>
        {currentUser.photoUrl && (
          <img src={currentUser.photoUrl} alt={currentUser.name} className="rounded-full w-7 h-7" />
        )}
      </div>
    </nav>
  );
}
