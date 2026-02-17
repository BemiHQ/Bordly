import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { H1 } from '@/components/ui/h1';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

import { useTRPC } from '@/trpc';
import { ROUTES } from '@/utils/urls';

export const Route = createFileRoute('/welcome')({
  component: Welcome,
  beforeLoad: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(context.trpc.user.getCurrentUser.queryOptions());
    if (!currentUser) {
      throw redirect({ to: ROUTES.AUTH });
    }
    if (currentUser.boards.length > 0) {
      throw redirect({ to: ROUTES.HOME });
    }
    return { currentUser };
  },
});

function Welcome() {
  const [boardName, setBoardName] = useState('');
  const trpc = useTRPC();
  const createBoardMutation = useMutation(
    trpc.board.createBoard.mutationOptions({
      onSuccess: () => {
        console.log('Successfully created board...');
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (boardName.trim()) {
      createBoardMutation.mutate({ name: boardName });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 max-w-md mx-auto px-4">
      <H1>Create your first board</H1>

      <span className="text-muted-foreground text-center">
        Boards are sharable spaces where you and your team can collaborate on emails.
      </span>

      <form onSubmit={handleSubmit} className="w-full">
        <Card>
          <CardContent>
            <Field>
              <FieldLabel>Board Name</FieldLabel>
              <Input placeholder="Company Board" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
            </Field>
          </CardContent>
          <CardFooter className="justify-center">
            <Button
              type="submit"
              size="lg"
              variant="contrast"
              disabled={!boardName.trim() || createBoardMutation.isPending}
              className="flex items-center gap-2"
            >
              {createBoardMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Creating...
                </>
              ) : (
                'Create Board'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
