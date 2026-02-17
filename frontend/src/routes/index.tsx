import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Env } from '@/utils/env';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button size="lg" asChild>
        <a href={`${Env.VITE_API_ENDPOINT}/auth/google`}>Continue with Google</a>
      </Button>
    </div>
  );
}
